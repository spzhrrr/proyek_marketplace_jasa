const opts = { credentials: "include", headers: { "Content-Type": "application/json" } };

async function request(url, options = {}) {
  const res = await fetch(url, { ...opts, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Terjadi kesalahan");
    err.status = res.status;
    err.errors = data.errors;
    err.need = data.need;
    throw err;
  }
  return data;
}

async function upload(url, formData) {
  try {
    const res = await fetch(url, { method: "POST", credentials: "include", body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "Upload gagal");
      err.status = res.status;
      err.errors = data.errors;
      err.need = data.need;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.message === "Failed to fetch") {
      throw new Error("Gagal terhubung ke server backend. Pastikan server backend Anda sudah berjalan di port 5000.");
    }
    throw err;
  }
}

async function gatewayRequest(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Permintaan gateway gagal");
  }
  return data;
}

export const api = {
  home: () => request("/api/mp/home"),
  me: () => request("/api/mp/me"),
  register: (body) => request("/api/mp/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/mp/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/api/mp/auth/logout", { method: "POST" }),
  categories: () => request("/api/mp/categories"),

  jasaList: (q) => request(`/api/mp/jasa?${new URLSearchParams(q || {})}`),
  jasaShow: (id) => request(`/api/mp/jasa/${id}`),
  jasaCreate: (fd) => upload("/api/mp/jasa", fd),
  jasaUpdate: (id, fd) =>
    fetch(`/api/mp/jasa/${id}`, { method: "PUT", credentials: "include", body: fd }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || "Gagal update jasa");
        err.errors = data.errors;
        err.need = data.need;
        throw err;
      }
      return data;
    }),
  jasaDelete: (id) => request(`/api/mp/jasa/${id}`, { method: "DELETE" }),
  jasaSewa: (id, body) =>
    request(`/api/mp/jasa/${id}/sewa`, { method: "POST", body: JSON.stringify(body) }),
  jasaChat: (id, withUserId) => {
    const q = withUserId ? `?with=${encodeURIComponent(withUserId)}` : "";
    return request(`/api/mp/jasa/${id}/chat${q}`);
  },
  jasaChatSend: (id, pesan, targetUserId) =>
    request(`/api/mp/jasa/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({
        pesan,
        ...(targetUserId != null ? { target_user_id: targetUserId } : {}),
      }),
    }),

  chats: () => request("/api/mp/chats"),
  chatThread: (room) => request(`/api/mp/chats/thread?room=${encodeURIComponent(room)}`),
  chatSend: (room, pesan) =>
    request("/api/mp/chats", { method: "POST", body: JSON.stringify({ room, pesan }) }),
  chatRead: (room) =>
    request("/api/mp/chats/read", { method: "POST", body: JSON.stringify({ room }) }),

  lowonganList: (q) => request(`/api/mp/lowongan?${new URLSearchParams(q || {})}`),
  lowonganShow: (id) => request(`/api/mp/lowongan/${id}`),
  lowonganCreate: (body) =>
    request("/api/mp/lowongan", { method: "POST", body: JSON.stringify(body) }),
  lowonganUpdate: (id, body) =>
    request(`/api/mp/lowongan/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  lowonganDelete: (id) => request(`/api/mp/lowongan/${id}`, { method: "DELETE" }),
  lowonganClose: (id) => request(`/api/mp/lowongan/${id}/tutup`, { method: "POST" }),
  lowonganLamar: (id, fd) => upload(`/api/mp/lowongan/${id}/lamar`, fd),
  lowonganChat: (id, withUserId) => {
    const q = withUserId ? `?with=${encodeURIComponent(withUserId)}` : "";
    return request(`/api/mp/lowongan/${id}/chat${q}`);
  },
  lowonganChatSend: (id, pesan, targetUserId) =>
    request(`/api/mp/lowongan/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({
        pesan,
        ...(targetUserId != null ? { target_user_id: targetUserId } : {}),
      }),
    }),
  dashboard: () => request("/api/mp/dashboard"),
  notifikasi: () => request("/api/mp/notifikasi"),
  notifikasiBaca: (id) => request(`/api/mp/notifikasi/${id}/baca`, { method: "POST" }),
  notifikasiBacaSemua: () => request("/api/mp/notifikasi/baca-semua", { method: "POST" }),

  orderShow: (id) => request(`/api/mp/orders/${id}`),
  orderAccept: (id) => request(`/api/mp/orders/${id}/terima`, { method: "POST" }),
  orderReject: (id, reason) =>
    request(`/api/mp/orders/${id}/tolak`, { method: "POST", body: JSON.stringify({ reason }) }),
  orderCancel: (id, reason) =>
    request(`/api/mp/orders/${id}/batal`, { method: "POST", body: JSON.stringify({ reason }) }),
  paymentInfo: (id) => request(`/api/mp/orders/${id}/bayar`),
  paymentProcess: (id, method) =>
    request(`/api/mp/orders/${id}/bayar`, {
      method: "POST",
      body: JSON.stringify({ payment_method: method }),
    }),
  paymentCheck: (id) => request(`/api/mp/orders/${id}/cek-bayar`),
  submitWork: (id, fd) => upload(`/api/mp/orders/${id}/kirim-bukti`, fd),
  approveWork: (id, review_note) =>
    request(`/api/mp/orders/${id}/setujui`, {
      method: "POST",
      body: JSON.stringify({ review_note }),
    }),
  requestRevision: (id, review_note) =>
    request(`/api/mp/orders/${id}/minta-revisi`, {
      method: "POST",
      body: JSON.stringify({ review_note }),
    }),
  submitReview: (id, body) =>
    request(`/api/mp/orders/${id}/review`, { method: "POST", body: JSON.stringify(body) }),

  applicationAccept: (id) => request(`/api/mp/applications/${id}/terima`, { method: "POST" }),
  applicationReject: (id, body) => request(`/api/mp/applications/${id}/tolak`, { method: "POST", body: JSON.stringify(body || {}) }),
  getServiceRequests: (id) => request(`/api/mp/jasa/${id}/requests`),
  getJobApplications: (id) => request(`/api/mp/lowongan/${id}/lamaran`),
  toggleJasaActive: (id) => request(`/api/mp/jasa/${id}/toggle-active`, { method: "PATCH" }),
  toggleLowonganActive: (id) => request(`/api/mp/lowongan/${id}/toggle-active`, { method: "PATCH" }),

  verifyHub: () => request("/api/mp/verify"),
  verifyEmailStatus: () => request("/api/mp/verify/email"),
  sendEmailOtp: () => request("/api/mp/verify/email/send", { method: "POST" }),
  confirmEmailOtp: (otp) =>
    request("/api/mp/verify/email/confirm", { method: "POST", body: JSON.stringify({ otp }) }),
  verifyPhoneStatus: () => request("/api/mp/verify/phone"),
  sendPhoneOtp: () => request("/api/mp/verify/phone/send", { method: "POST" }),
  confirmPhoneOtp: (otp) =>
    request("/api/mp/verify/phone/confirm", { method: "POST", body: JSON.stringify({ otp }) }),
  submitKtp: (fd) => upload("/api/mp/verify/ktp", fd),
  submitBank: (body) => request("/api/mp/verify/bank", { method: "POST", body: JSON.stringify(body) }),

  profileShow: (id) => request(`/api/mp/profile/${id}`),
  profileUpdate: (fd) =>
    fetch("/api/mp/profile/me", { method: "PUT", credentials: "include", body: fd }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || "Gagal simpan profil");
        err.errors = data.errors;
        throw err;
      }
      return data;
    }),
  profileChangeEmailStart: (email) =>
    request("/api/mp/profile/email/start", { method: "POST", body: JSON.stringify({ email }) }),
  profileChangeEmailConfirm: (email, otp) =>
    request("/api/mp/profile/email/confirm", { method: "POST", body: JSON.stringify({ email, otp }) }),
  profileChangePhoneStart: (phone) =>
    request("/api/mp/profile/phone/start", { method: "POST", body: JSON.stringify({ phone }) }),
  profileChangePhoneConfirm: (phone, otp) =>
    request("/api/mp/profile/phone/confirm", { method: "POST", body: JSON.stringify({ phone, otp }) }),
  profileAddPortfolio: (fd) => upload("/api/mp/profile/portfolio", fd),
  profileDeletePortfolio: (itemId) =>
    request(`/api/mp/profile/portfolio/${itemId}`, { method: "DELETE" }),

  adminKtp: () => request("/api/mp/admin/ktp"),
  adminKtpDetail: (id) => request(`/api/mp/admin/ktp/${id}`),
  adminDashboard: () => request("/api/mp/admin/dashboard"),
  adminUsers: () => request("/api/mp/admin/users"),
  adminUserDetail: (id) => request(`/api/mp/admin/users/${id}`),
  adminOrders: (status = "all") => request(`/api/mp/admin/orders?status=${status}`),
  adminApproveKtp: (id) => request(`/api/mp/admin/ktp/${id}/approve`, { method: "POST" }),
  adminRejectKtp: (id, payload) =>
    request(`/api/mp/admin/ktp/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(typeof payload === "string" ? { reason: payload } : payload),
    }),

  adminBank: () => request("/api/mp/admin/bank"),
  adminBankDetail: (id) => request(`/api/mp/admin/bank/${id}`),
  adminApproveBank: (id) => request(`/api/mp/admin/bank/${id}/approve`, { method: "POST" }),
  adminRejectBank: (id, reason) =>
    request(`/api/mp/admin/bank/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  orderDispute: (id, reason) =>
    request(`/api/mp/orders/${id}/dispute`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminResolveDispute: (id, outcome, note) =>
    request(`/api/mp/admin/orders/${id}/resolve-dispute`, {
      method: "POST",
      body: JSON.stringify({ outcome, note }),
    }),

  requestWithdrawal: (amount) =>
    request("/api/mp/withdrawals", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),
  listWithdrawals: () => request("/api/mp/withdrawals"),
  adminWithdrawals: () => request("/api/mp/admin/withdrawals"),
  adminApproveWithdrawal: (id, note) =>
    request(`/api/mp/admin/withdrawals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  adminRejectWithdrawal: (id, note) =>
    request(`/api/mp/admin/withdrawals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  createUserReport: (body) => request("/api/mp/reports", { method: "POST", body: JSON.stringify(body) }),
  adminReports: () => request("/api/mp/admin/reports"),
  adminActionReport: (reportId, body) =>
    request(`/api/mp/admin/reports/${reportId}/action`, { method: "POST", body: JSON.stringify(body) }),

  getTransaction: (code) =>
    gatewayRequest(`/gateway/api/transactions/${code}`).then((d) => {
      if (!d.transaction) throw new Error(d.error || "Transaksi tidak ditemukan");
      return d.transaction;
    }),
  payTransaction: (code) =>
    gatewayRequest(`/gateway/api/transactions/${code}/pay`, { method: "POST" }),
  failTransaction: (code) =>
    gatewayRequest(`/gateway/api/transactions/${code}/fail`, { method: "POST" }),
  listTransactions: () =>
    gatewayRequest("/gateway/api/transactions").then((d) => d.transactions || []),
  lookupReturn: (code) =>
    fetch(`/api/payments/lookup/${code}`).then((r) => (r.ok ? r.json() : null)),
};
