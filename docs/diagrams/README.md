# Diagram laporan (kode Mermaid)

Render PNG:

```
cd docs
set DIAGRAMS_ONLY=1
node capture_laporan.mjs
```

Struktur narasi: `docs/FLOW_SISTEM.md`.

| File | Flow |
|---|---|
| `alur-sistem.mmd` | Ringkasan komponen |
| `auth-register.mmd` | Autentikasi — register |
| `auth-login.mmd` | Autentikasi — login |
| `auth-sesi.mmd` | Autentikasi — sesi & logout |
| `data-sukses.mmd` | Alur data — sukses |
| `data-gagal.mmd` | Alur data — gagal |
| `sewa-minta.mmd` | Sewa — permintaan |
| `sewa-bayar.mmd` | Sewa — bayar escrow |
| `sewa-selesai.mmd` | Sewa — selesai / sengketa |
| `kerja-lamar.mmd` | Kerja — pasang & lamar |
| `kerja-terima.mmd` | Kerja — terima 1 pelamar |
| `kerja-tutup.mmd` | Kerja — tutup / hapus |
| `erd.mmd` | ERD ringkas |
