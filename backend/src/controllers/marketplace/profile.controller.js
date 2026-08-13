import userModel from "../../models/user/userModel.js";
import serviceModel from "../../models/marketplace/serviceModel.js";
import jobModel, { stripJobSkills } from "../../models/marketplace/jobModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import reviewModel from "../../models/marketplace/reviewModel.js";
import { validateEmail, validatePassword, validateName, validatePhone, normalizePhone, validateBio } from "../../utils/validators.js";
import { capitalizeName } from "../../utils/userDisplay.js";
import { buildSessionUser } from "../../services/user/sessionUser.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { generateOtp, hashOtp, compareOtp, getExpiry, isExpired, saveMockOtp, clearMockOtp, setPendingChange, getPendingChange, clearPendingChange } from "../../utils/otp.js";
import portfolioModel from "../../models/user/portfolioModel.js";
import { uid, fail, refreshUser, validateCategory } from "./_helpers.js";

function mapProfileService(s, isOwner, owner) {
  const ownerName = owner ? `${owner.first_name || ""} ${owner.last_name || ""}`.trim() : "";
  return {
    id: s.id,
    seller_id: s.seller_id || owner?.id,
    title: s.title,
    description: s.description || "",
    skills: s.skills || "",
    price: s.price,
    delivery_days: s.delivery_days,
    cover_image_url: s.cover_image_url || "",
    is_active: Number(s.is_active) === 1,
    category_name: s.category_name || "",
    parent_type: s.parent_type || s.category_type || "",
    city: s.seller_city || s.city || owner?.city || "",
    seller_name: s.seller_name || ownerName,
    seller_avatar: s.seller_avatar || owner?.profilepic_url || "",
    seller_city: s.seller_city || owner?.city || "",
    seller_ktp_status: s.seller_ktp_status || owner?.ktp_status || "",
    seller_rating: s.seller_rating,
    seller_review_count: s.seller_review_count,
    completed_count: s.completed_count,
    created_at: s.created_at,
    ...(isOwner ? { can_edit: true } : {}),
  };
}

function mapProfileJob(j, isOwner, owner) {
  const ownerName = owner ? `${owner.first_name || ""} ${owner.last_name || ""}`.trim() : "";
  return {
    id: j.id,
    buyer_id: j.buyer_id || owner?.id,
    title: j.title,
    description: stripJobSkills(j.description || ""),
    budget: j.budget,
    status: j.status,
    deadline: j.deadline || null,
    is_urgent: Number(j.is_urgent) === 1,
    is_active: Number(j.is_active) !== 0,
    category_name: j.category_name || "",
    parent_type: j.parent_type || j.category_type || "",
    city: j.city || j.buyer_city || owner?.city || "",
    buyer_name: j.buyer_name || j.poster_name || ownerName,
    poster_name: j.poster_name || j.buyer_name || ownerName,
    poster_avatar: j.poster_avatar || j.buyer_avatar || owner?.profilepic_url || "",
    poster_ktp_status: j.poster_ktp_status || owner?.ktp_status || "",
    applicant_count: Number(j.applicant_count) || 0,
    created_at: j.created_at,
    ...(isOwner ? { can_edit: true } : {}),
  };
}

function mapProfileHistory(o, { withAmount, counterpart }) {
  return {
    id: o.id,
    title: o.title,
    source: o.source,
    completed_at: o.completed_at,
    ...(withAmount ? { amount: o.amount } : {}),
    ...(counterpart ? { counterpart } : {}),
  };
}

function mapProfileReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer_id: r.reviewer_id,
    reviewer_name: r.reviewer_name,
    order_title: r.order_title,
    order_source: r.order_source,
    order_seller_id: r.order_seller_id,
    order_buyer_id: r.order_buyer_id,
  };
}

async function profileShow(req, res) {
  try {
    const user = await userModel.findPublicProfile(req.params.id);
    if (!user) return fail(res, 404, "Profil tidak ditemukan");

    const isOwner = req.user && uid(req.user.id) === uid(user.id);
    const isAdmin = req.user && req.user.role === "ADMIN";
    const privateView = isOwner || isAdmin;
    const identityVerified = user.ktp_status === "APPROVED";

    let profile = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      bio: user.bio,
      city: user.city,
      province: user.province,
      profilepic_url: user.profilepic_url,
      created_at: user.created_at,
      identity_verified: identityVerified,
    };

    if (privateView) {
      const full = await userModel.findById(user.id);
      profile = {
        ...profile,
        email: full?.email || null,
        phone: full?.phone || null,
        email_verified_at: full?.email_verified_at || null,
        phone_verified_at: full?.phone_verified_at || null,
        ktp_status: full?.ktp_status || user.ktp_status,
        ktp_number: full?.ktp_number || null,
        bank_status: full?.bank_status || null,
        bank_name: full?.bank_name || null,
        bank_account_number: full?.bank_account_number || null,
        bank_account_holder: full?.bank_account_holder || null,
      };
    }

    const [ratingStats, reviewsRaw, allServices, allJobs, doneAsSeller, doneAsBuyer, portfolios] =
      await Promise.all([
        reviewModel.getStatsForUser(user.id),
        reviewModel.findByReviewee(user.id),
        serviceModel.findBySeller(user.id),
        jobModel.findByBuyer(user.id),
        orderModel.findCompletedAsSeller(user.id),
        privateView ? orderModel.findCompletedAsBuyer(user.id) : Promise.resolve([]),
        portfolioModel.findByUser(user.id),
      ]);

    const publicServices = allServices.filter((s) => Number(s.is_active) === 1);
    const publicJobs = allJobs.filter((j) =>
      (j.status === "OPEN" && Number(j.is_active) !== 0) || j.status === "FILLED",
    );
    const services = (privateView ? allServices : publicServices).map((s) => mapProfileService(s, privateView, user));
    const jobs = (privateView ? allJobs : publicJobs).map((j) => mapProfileJob(j, privateView, user));
    const workHistory = doneAsSeller.map((o) => mapProfileHistory(o, {
      withAmount: privateView,
      counterpart: privateView ? o.buyer_name : "",
    }));
    const hireHistory = privateView
      ? doneAsBuyer.map((o) => mapProfileHistory(o, { withAmount: true, counterpart: o.seller_name }))
      : [];

    res.json({
      ok: true,
      user: {
        ...profile,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        member_since: profile.created_at,
      },
      is_own: !!isOwner,
      stats: {
        jasa: publicServices.length,
        lowongan: publicJobs.filter((j) => j.status === "OPEN").length,
        completed: doneAsSeller.length,
        rating: ratingStats.avg_rating || 0,
        rating_count: ratingStats.total || 0,
        portfolio: portfolios.length,
      },
      ratingStats,
      reviews: reviewsRaw.map(mapProfileReview),
      services,
      jobs,
      workHistory,
      hireHistory,
      portfolios: portfolios.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description || "",
        category_id: p.category_id || null,
        category_name: p.category_name || "",
        category_code: p.category_code || "",
        parent_name: p.parent_name || "",
        parent_type: p.parent_type || "",
        parent_code: p.parent_code || "",
        image_url: p.image_url || "",
        file_url: p.file_url || "",
        created_at: p.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileUpdate(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);
    const {
      bio, city, province, onboarding, first_name, last_name,
      remove_photo, current_password, new_password, new_password_confirm,
    } = req.body;
    const requireComplete = onboarding === "true" || onboarding === true;
    const bioText = bio?.trim() || "";
    const cityText = city?.trim() || "";
    const provinceText = province?.trim() || "";
    const removePhoto = remove_photo === "true" || remove_photo === true;
    let profilepic_url = null;
    if (req.file?.filename) {
      profilepic_url = "/uploads/profile/" + req.file.filename;
    }

    const current = await userModel.findById(req.user.id);
    const errors = [];
    errors.push(...validateBio(bioText, { required: requireComplete }));
    if (requireComplete) {
      if (!cityText) errors.push("Kota wajib diisi");
      if (!provinceText) errors.push("Provinsi wajib diisi");
      if (!profilepic_url && !current?.profilepic_url) {
        errors.push("Foto profil wajib diupload");
      }
    }

    const ktpLocked = current?.ktp_status === "APPROVED" || current?.ktp_status === "PENDING";
    let nextFirst = null;
    let nextLast = null;
    if (!ktpLocked && (first_name != null || last_name != null)) {
      if (first_name != null) errors.push(...validateName(first_name, "Nama depan"));
      if (last_name != null) errors.push(...validateName(last_name, "Nama belakang"));
      nextFirst = first_name ? capitalizeName(first_name) : null;
      nextLast = last_name ? capitalizeName(last_name) : null;
    }

    const wantsPassword = Boolean(new_password || new_password_confirm || current_password);
    if (wantsPassword) {
      if (!current_password) errors.push("Password saat ini wajib diisi");
      errors.push(...validatePassword(new_password));
      if (new_password !== new_password_confirm) errors.push("Konfirmasi password baru tidak sama");
      if (current_password && current?.password_hash) {
        const ok = await userModel.comparePassword(current_password, current.password_hash);
        if (!ok) errors.push("Password saat ini salah");
      }
    }

    if (errors.length) return fail(res, 400, errors[0], errors);

    await userModel.updateProfile(req.user.id, {
      first_name: nextFirst,
      last_name: nextLast,
      bio: bioText,
      city: cityText,
      province: provinceText,
      profilepic_url,
      remove_photo: removePhoto && !profilepic_url,
    });

    if (wantsPassword) {
      await userModel.updatePassword(req.user.id, new_password);
    }

    const fresh = await refreshUser(res, req.user.id);
    res.json({ ok: true, user: buildSessionUser(fresh) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangeEmailStart(req, res) {
  try {
    const errors = validateEmail(req.body.email);
    if (errors.length) return fail(res, 400, errors[0], errors);
    const email = req.body.email.trim().toLowerCase();
    const current = await userModel.findById(req.user.id);
    if (email === (current.email || "").toLowerCase()) {
      return fail(res, 400, "Email baru sama dengan email saat ini");
    }
    const taken = await userModel.findByEmail(email);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Email sudah dipakai akun lain");
    }
    const otp = generateOtp();
    await userModel.saveEmailOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "email-change", otp);
    setPendingChange(req.user.id, "email", email);
    res.json({ ok: true, mockOtp: otp, email });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangeEmailConfirm(req, res) {
  try {
    const pending = getPendingChange(req.user.id, "email");
    const email = (req.body.email || "").trim().toLowerCase();
    if (!pending || pending !== email) {
      return fail(res, 400, "Kirim OTP ke email baru terlebih dahulu");
    }
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.email_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.email_otp_hash))) return fail(res, 400, "OTP salah");
    const taken = await userModel.findByEmail(email);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Email sudah dipakai akun lain");
    }
    await userModel.updateEmail(req.user.id, email);
    clearMockOtp(req.user.id, "email-change");
    clearPendingChange(req.user.id, "email");
    const fresh = await refreshUser(res, req.user.id);
    res.json({ ok: true, user: buildSessionUser(fresh) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangePhoneStart(req, res) {
  try {
    const errors = validatePhone(req.body.phone);
    if (errors.length) return fail(res, 400, errors[0], errors);
    const phone = normalizePhone(req.body.phone);
    const current = await userModel.findById(req.user.id);
    if (phone === current.phone) {
      return fail(res, 400, "Nomor baru sama dengan nomor saat ini");
    }
    const taken = await userModel.findByPhone(phone);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Nomor HP sudah dipakai akun lain");
    }
    const otp = generateOtp();
    await userModel.savePhoneOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "phone-change", otp);
    setPendingChange(req.user.id, "phone", phone);
    res.json({ ok: true, mockOtp: otp, phone });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangePhoneConfirm(req, res) {
  try {
    const pending = getPendingChange(req.user.id, "phone");
    const phone = normalizePhone(req.body.phone || "");
    if (!pending || pending !== phone) {
      return fail(res, 400, "Kirim OTP ke nomor baru terlebih dahulu");
    }
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.phone_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.phone_otp_hash))) return fail(res, 400, "OTP salah");
    const taken = await userModel.findByPhone(phone);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Nomor HP sudah dipakai akun lain");
    }
    await userModel.updatePhone(req.user.id, phone);
    clearMockOtp(req.user.id, "phone-change");
    clearPendingChange(req.user.id, "phone");
    const fresh = await refreshUser(res, req.user.id);
    res.json({ ok: true, user: buildSessionUser(fresh) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileAddPortfolio(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);
    const title = String(req.body.title || "").trim();
    if (title.length < 3) return fail(res, 400, "Judul portfolio minimal 3 karakter");
    if (title.length > 120) return fail(res, 400, "Judul portfolio maksimal 120 karakter");
    const description = String(req.body.description || "").trim().slice(0, 240);
    const file = req.files?.portfolio_file?.[0];
    if (!file) return fail(res, 400, "Unggah file karya (gambar, PDF, atau dokumen)");

    const existing = await portfolioModel.countByUser(req.user.id);
    if (existing >= 12) return fail(res, 400, "Maksimal 12 karya di portfolio");

    let categoryId = req.body.category_id ? parseInt(req.body.category_id, 10) : null;
    if (categoryId) {
      const catErr = await validateCategory(categoryId);
      if (catErr) return fail(res, 400, catErr);
    } else {
      categoryId = null;
    }

    const url = "/uploads/profile/" + file.filename;
    const isImage = String(file.mimetype || "").startsWith("image/");
    const id = await portfolioModel.create({
      user_id: req.user.id,
      category_id: categoryId,
      title,
      description,
      image_url: isImage ? url : "",
      file_url: url,
    });

    res.json({ ok: true, id });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileDeletePortfolio(req, res) {
  try {
    const ok = await portfolioModel.remove(req.params.itemId, req.user.id);
    if (!ok) return fail(res, 404, "Item portfolio tidak ditemukan");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  profileShow,
  profileUpdate,
  profileChangeEmailStart,
  profileChangeEmailConfirm,
  profileChangePhoneStart,
  profileChangePhoneConfirm,
  profileAddPortfolio,
  profileDeletePortfolio,
};
