import userModel from "../../models/user/userModel.js";
import { validateKtpNumber } from "../../utils/validators.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { generateOtp, hashOtp, compareOtp, getExpiry, isExpired, saveMockOtp, getMockOtp, clearMockOtp } from "../../utils/otp.js";
import { isEmailVerified, isPhoneVerified, isContactVerified, isKtpApproved, isBankVerified, bankStatusOf } from "../../services/user/verification.js";
import { fail, refreshUser } from "./_helpers.js";

async function verifyHub(req, res) {
  try {
    const user = await refreshUser(res, req.user.id);
    const emailDone = isEmailVerified(user);
    const phoneDone = isPhoneVerified(user);
    const ktpStatus = user.ktp_status || "NOT_SUBMITTED";

    let nextStep = "done";
    if (!emailDone) nextStep = "email";
    else if (!phoneDone) nextStep = "phone";
    else if (ktpStatus !== "APPROVED") nextStep = "ktp";
    else if (!isBankVerified(user)) nextStep = "bank";

    const bankStatus = bankStatusOf(user);

    res.json({
      ok: true,
      user,
      steps: {
        email: { done: emailDone, status: emailDone ? "VERIFIED" : "PENDING" },
        phone: {
          done: phoneDone,
          status: phoneDone ? "VERIFIED" : emailDone ? "PENDING" : "LOCKED",
        },
        ktp: {
          status: ktpStatus,
          done: ktpStatus === "APPROVED",
          rejectedReason: user.ktp_rejected_reason || null,
          canSubmit:
            emailDone &&
            phoneDone &&
            (ktpStatus === "NOT_SUBMITTED" || ktpStatus === "REJECTED"),
          pending: ktpStatus === "PENDING",
        },
        bank: {
          done: isBankVerified(user),
          status: bankStatus,
          bank_name: user.bank_name || "",
          bank_account_number: user.bank_account_number || "",
          bank_account_holder: user.bank_account_holder || "",
          rejectedReason: user.bank_rejected_reason || null,
          canSubmit:
            emailDone &&
            phoneDone &&
            ktpStatus === "APPROVED" &&
            (bankStatus === "NOT_SUBMITTED" || bankStatus === "REJECTED"),
          pending: bankStatus === "PENDING",
        },
      },
      level1: isContactVerified(user),
      level2: isKtpApproved(user),
      level3: isBankVerified(user),
      nextStep,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function verifyEmailStatus(req, res) {
  try {
    res.json({
      ok: true,
      verified: isEmailVerified(req.user),
      email: req.user.email,
      mockOtp: getMockOtp(req.user.id, "email"),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function sendEmailOtp(req, res) {
  try {
    if (isEmailVerified(req.user)) return res.json({ ok: true, already: true });
    const otp = generateOtp();
    await userModel.saveEmailOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "email", otp);
    res.json({ ok: true, mockOtp: otp });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function confirmEmailOtp(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.email_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.email_otp_hash))) return fail(res, 400, "OTP salah");

    await userModel.verifyEmail(req.user.id);
    clearMockOtp(req.user.id, "email");
    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function verifyPhoneStatus(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    res.json({
      ok: true,
      verified: isPhoneVerified(req.user),
      emailVerified: isEmailVerified(req.user),
      phone: user.phone,
      mockOtp: getMockOtp(req.user.id, "phone"),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function sendPhoneOtp(req, res) {
  try {
    if (!isEmailVerified(req.user)) return fail(res, 403, "Verifikasi email dulu");
    const user = await userModel.findById(req.user.id);
    if (!user.phone) return fail(res, 400, "Nomor HP belum diisi saat registrasi");

    const otp = generateOtp();
    await userModel.savePhoneOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "phone", otp);
    res.json({ ok: true, mockOtp: otp });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function confirmPhoneOtp(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.phone_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.phone_otp_hash))) return fail(res, 400, "OTP salah");

    await userModel.verifyPhone(req.user.id);
    clearMockOtp(req.user.id, "phone");
    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitKtp(req, res) {
  try {
    if (!isContactVerified(req.user)) return fail(res, 403, "Verifikasi email & HP dulu");
    if (req.user.ktp_status === "APPROVED") {
      return fail(res, 400, "KTP sudah disetujui dan tidak bisa diajukan ulang");
    }
    if (req.user.ktp_status === "PENDING") {
      return fail(res, 400, "KTP masih menunggu review admin");
    }

    const { ktp_number, ktp_name, ktp_birthplace, ktp_birthdate, ktp_gender, ktp_address } = req.body;
    const errors = [];
    if (req.ktpUploadError) errors.push(req.ktpUploadError);
    errors.push(...validateKtpNumber(ktp_number));
    if (!ktp_name || ktp_name.trim().length < 2) {
      errors.push("Nama lengkap sesuai KTP wajib diisi (minimal 2 karakter)");
    }
    if (!ktp_birthplace || ktp_birthplace.trim().length < 2) {
      errors.push("Tempat lahir wajib diisi");
    }
    if (!ktp_birthdate) {
      errors.push("Tanggal lahir wajib diisi");
    }
    if (!ktp_address || ktp_address.trim().length < 5) {
      errors.push("Alamat KTP wajib diisi lengkap");
    }

    const photoFile = req.files?.ktp_photo?.[0];
    const selfieFile = req.files?.ktp_selfie?.[0];
    if (!photoFile) errors.push("Foto KTP wajib diupload");
    if (!selfieFile) errors.push("Foto selfie dengan KTP wajib diupload");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const ok = await userModel.submitKtp(req.user.id, {
      ktp_name: ktp_name.trim(),
      ktp_number: ktp_number.trim(),
      ktp_birthplace: ktp_birthplace.trim(),
      ktp_birthdate: ktp_birthdate,
      ktp_gender: ktp_gender || "LAKI-LAKI",
      ktp_address: ktp_address.trim(),
      ktp_photo_url: "/uploads/ktp/" + photoFile.filename,
      ktp_selfie_url: "/uploads/ktp/" + selfieFile.filename,
    });
    if (!ok) return fail(res, 400, "KTP tidak bisa diajukan ulang pada status saat ini");

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitBank(req, res) {
  try {
    if (!isContactVerified(req.user)) {
      return fail(res, 403, "Verifikasi Email & Nomor HP terlebih dahulu");
    }
    if (!isKtpApproved(req.user)) {
      return fail(res, 403, "Verifikasi KTP wajib disetujui sebelum mengajukan rekening bank");
    }
    if (isBankVerified(req.user)) {
      return fail(res, 400, "Rekening bank sudah diverifikasi dan tidak bisa diajukan ulang");
    }
    if (bankStatusOf(req.user) === "PENDING") {
      return fail(res, 400, "Rekening bank masih menunggu review admin");
    }

    const { bank_name, bank_account_number, bank_account_holder } = req.body;
    const errors = [];
    if (!bank_name?.trim()) errors.push("Nama bank wajib diisi");
    if (!bank_account_number?.trim()) errors.push("Nomor rekening wajib diisi");
    if (!bank_account_holder?.trim()) errors.push("Nama pemilik rekening wajib diisi");
    if (errors.length) return fail(res, 400, errors[0], errors);

    const ok = await userModel.updateBank(req.user.id, {
      bank_name: bank_name.trim(),
      bank_account_number: bank_account_number.trim(),
      bank_account_holder: bank_account_holder.trim(),
    });
    if (!ok) return fail(res, 400, "Rekening tidak bisa diajukan ulang pada status saat ini");

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  verifyHub,
  verifyEmailStatus,
  sendEmailOtp,
  confirmEmailOtp,
  verifyPhoneStatus,
  sendPhoneOtp,
  confirmPhoneOtp,
  submitKtp,
  submitBank,
};
