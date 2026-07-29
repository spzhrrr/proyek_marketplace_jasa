# Thunder Client — Test API Marketplace

**Base URL:** `http://localhost:3000`  
**Cookie auth:** Aktifkan "Cookies" di Thunder Client. Login menyimpan `token` cookie.

**Akun seed admin:** `admin@mail.com` / `admin123`

**Gateway API Key:** `pg-key-coursenet-mock-2026` (header `X-Api-Key`)  
**Webhook Secret:** `pg-wh-secret-coursenet-mock` (header `X-Webhook-Secret`)

**Category ID (sub):** `3`=Desain Grafis, `4`=Penulisan, `5`=Web, `6`=Kebersihan, `7`=Renovasi, `8`=Kurir

---

## Urutan test flow lengkap (disarankan)

1. Register Penjual + Pembeli → Login masing-masing
2. Lengkapi profil (form-data) → Verifikasi email → phone → KTP (form-data)
3. Admin approve KTP kedua user
4. Penjual: verifikasi bank → Post jasa (form-data)
5. Pembeli: Sewa jasa → Penjual terima → Pembeli bayar → Gateway pay → Cek bayar
6. Penjual kirim bukti (form-data) → Pembeli setujui → Review
7. (Opsional) Flow lowongan: post → lamar → terima → bayar → selesai

---

## 1. Auth

### POST `/api/mp/auth/register` — Penjual
```json
{
  "first_name": "Budi",
  "last_name": "Penjual",
  "email": "penjual@test.com",
  "phone": "081234567801",
  "password": "Test1234",
  "password_confirm": "Test1234"
}
```

### POST `/api/mp/auth/register` — Pembeli
```json
{
  "first_name": "Ani",
  "last_name": "Pembeli",
  "email": "pembeli@test.com",
  "phone": "081234567802",
  "password": "Test1234",
  "password_confirm": "Test1234"
}
```

### POST `/api/mp/auth/login`
```json
{
  "email": "penjual@test.com",
  "password": "Test1234"
}
```

### POST `/api/mp/auth/logout`
Body kosong `{}`

### GET `/api/mp/me`
Tanpa body (butuh cookie login)

---

## 2. Profil

### PUT `/api/mp/profile/me` — form-data (onboarding)
| Field | Value |
|-------|-------|
| bio | Desainer grafis berpengalaman 5 tahun |
| city | Jakarta |
| province | DKI Jakarta |
| onboarding | true |
| profilepic | *(file JPG/PNG)* |

### PUT `/api/mp/profile/me` — update biasa
| Field | Value |
|-------|-------|
| bio | Bio diperbarui |
| city | Bandung |
| province | Jawa Barat |

### POST `/api/mp/profile/portfolio` — form-data
| Field | Value |
|-------|-------|
| title | Logo Restoran |
| description | Desain logo minimalis |
| portfolio_image | *(file opsional)* |
| portfolio_file | *(file opsional)* |

### DELETE `/api/mp/profile/portfolio/:itemId`
Tanpa body

### GET `/api/mp/profile/:id`
Tanpa body

---

## 3. Verifikasi

### GET `/api/mp/verify`
### GET `/api/mp/verify/email`
### POST `/api/mp/verify/email/send` → `{}`  
Response berisi `mockOtp` — salin untuk confirm.

### POST `/api/mp/verify/email/confirm`
```json
{ "otp": "123456" }
```

### GET `/api/mp/verify/phone`
### POST `/api/mp/verify/phone/send` → `{}`
### POST `/api/mp/verify/phone/confirm`
```json
{ "otp": "123456" }
```

### POST `/api/mp/verify/ktp` — form-data
| Field | Value |
|-------|-------|
| ktp_number | 3174030303900001 |
| ktp_photo | *(file JPG)* |
| ktp_selfie | *(file JPG)* |

### POST `/api/mp/verify/bank`
```json
{
  "bank_name": "BCA",
  "bank_account_number": "1234567890",
  "bank_account_holder": "Budi Penjual"
}
```

---

## 4. Admin (login admin@mail.com)

### GET `/api/mp/admin/ktp`
### GET `/api/mp/admin/ktp/:userId`
### POST `/api/mp/admin/ktp/:userId/approve` → `{}`
### POST `/api/mp/admin/ktp/:userId/reject`
```json
{ "reason": "Foto KTP tidak jelas, unggah ulang" }
```

### GET `/api/mp/admin/dashboard`
### GET `/api/mp/admin/users`
### GET `/api/mp/admin/orders`

---

## 5. Katalog

### GET `/api/mp/categories`
### GET `/api/mp/home`
### GET `/api/mp/jasa?tipe=semua&sub=semua`
### GET `/api/mp/jasa/:id`
### GET `/api/mp/lowongan?tipe=semua&sub=semua`
### GET `/api/mp/lowongan/:id`

### POST `/api/mp/jasa` — form-data (login penjual + bank verified)
| Field | Value |
|-------|-------|
| judul_jasa | Desain Logo Profesional |
| deskripsi | Jasa desain logo untuk UMKM dengan 2 revisi |
| category_id | 3 |
| harga | 250000 |
| estimasi_hari | 5 |
| cover_image | *(file JPG wajib)* |
| portfolio_file | *(opsional)* |

### PUT `/api/mp/jasa/:id` — form-data (owner)
| Field | Value |
|-------|-------|
| judul_jasa | Desain Logo Premium |
| deskripsi | Jasa desain logo updated |
| category_id | 3 |
| harga | 300000 |
| estimasi_hari | 7 |

### DELETE `/api/mp/jasa/:id`
Body kosong `{}`

### POST `/api/mp/lowongan` — login pembeli + KTP approved
```json
{
  "judul_lowongan": "Butuh Desainer Banner",
  "deskripsi": "Membutuhkan desainer untuk banner promosi toko online",
  "category_id": "3",
  "gaji": "500000",
  "batas_waktu": "2026-12-31"
}
```

### PUT `/api/mp/lowongan/:id`
```json
{
  "judul_lowongan": "Butuh Desainer Banner Updated",
  "deskripsi": "Desain banner untuk campaign Ramadan",
  "category_id": "3",
  "gaji": "600000",
  "batas_waktu": "2026-12-31"
}
```

### DELETE `/api/mp/lowongan/:id` → `{}`

---

## 6. Flow Jasa (sewa → bayar → selesai)

### POST `/api/mp/jasa/:serviceId/sewa` — login pembeli
```json
{ "catatan": "Tolong buat logo minimalis warna biru" }
```

### POST `/api/mp/orders/:orderId/terima` — login penjual
```json
{}
```

### POST `/api/mp/orders/:orderId/tolak` — login penjual
```json
{ "reason": "Slot penuh minggu ini" }
```

### POST `/api/mp/orders/:orderId/batal` — login pembeli
```json
{ "reason": "Sudah tidak jadi pesan" }
```

### GET `/api/mp/orders/:orderId`
### GET `/api/mp/orders/:orderId/bayar`
### POST `/api/mp/orders/:orderId/bayar` — login pembeli
```json
{ "payment_method": "qris" }
```
Response: `redirectUrl` → buka di browser atau lanjut gateway API.

### GET `/api/mp/orders/:orderId/cek-bayar`
Polling setelah bayar di gateway.

### POST `/api/mp/orders/:orderId/kirim-bukti` — form-data (penjual)
| Field | Value |
|-------|-------|
| note | Logo sudah selesai revisi 1 |
| work_files | *(file JPG/PDF, bisa multiple)* |

### POST `/api/mp/orders/:orderId/setujui` — login pembeli
```json
{ "review_note": "Hasil sudah sesuai brief" }
```

### POST `/api/mp/orders/:orderId/minta-revisi` — login pembeli
```json
{ "review_note": "Warna logo terlalu gelap, tolong diperbaiki" }
```

### POST `/api/mp/orders/:orderId/review`
```json
{
  "rating": 5,
  "comment": "Pengerjaan cepat dan hasil memuaskan"
}
```

---

## 7. Flow Lowongan (lamar → bayar)

### POST `/api/mp/lowongan/:jobId/lamar` — form-data (login penjual/freelancer)
| Field | Value |
|-------|-------|
| proposed_price | 400000 |
| estimated_days | 7 |
| catatan | Saya berpengalaman desain banner e-commerce selama 3 tahun |
| portfolio_file | *(opsional)* |

### POST `/api/mp/applications/:applicationId/terima` — login pemberi kerja
```json
{}
```

### POST `/api/mp/applications/:applicationId/tolak` → `{}`

Setelah terima → order dibuat status ACCEPTED → lanjut bayar seperti order jasa.

---

## 8. Chat

### GET `/api/mp/jasa/:id/chat`
### POST `/api/mp/jasa/:id/chat`
```json
{ "pesan": "Halo, apakah masih available?" }
```

### GET `/api/mp/lowongan/:id/chat`
### POST `/api/mp/lowongan/:id/chat`
```json
{ "pesan": "Deadline bisa diperpanjang?" }
```

---

## 9. Dashboard & Notifikasi

### GET `/api/mp/dashboard`
### GET `/api/mp/notifikasi`
### POST `/api/mp/notifikasi/:id/baca` → `{}`
### POST `/api/mp/notifikasi/baca-semua` → `{}`

---

## 10. Payment Gateway (sesuai diagram dosen)

### POST `/gateway/api/transactions` — header `X-Api-Key: pg-key-coursenet-mock-2026`
```json
{
  "external_ref": "1",
  "amount": 262500,
  "payment_method": "qris",
  "customer_name": "Ani Pembeli",
  "customer_email": "pembeli@test.com",
  "description": "Bayar pesanan ORD-000001"
}
```

### GET `/gateway/api/transactions/:code` — Cek transaksi
### GET `/gateway/api/transactions` — Dashboard gateway
### POST `/gateway/api/transactions/:code/pay` — Bayar (mock Midtrans)
```json
{}
```

### POST `/gateway/api/transactions/:code/fail` → `{}`

### POST `/api/webhooks/payment-gateway` — header `X-Webhook-Secret: pg-wh-secret-coursenet-mock`
```json
{
  "transaction_code": "TXN-20260727-000001",
  "external_ref": "1",
  "status": "PAID",
  "amount": 262500
}
```

### GET `/api/payments/lookup/:code`
### GET `/api/payments/sync/:code`

---

## Catatan penting

- **Cookie:** Setiap user test butuh session terpisah (dua Thunder Client env atau clear cookie saat ganti role).
- **OTP:** Ambil dari response `mockOtp` setelah `send`, bukan tebak.
- **KTP:** Harus di-approve admin sebelum sewa/post lowongan/post jasa (jasa + bank).
- **Harga lamaran:** 50%–150% dari budget lowongan.
- **Platform fee:** 5% ditambahkan saat bayar (amount order + fee = total gateway).
