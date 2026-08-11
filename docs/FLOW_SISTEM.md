# Flow sistem Tolongin

Dokumen Word khusus (gambar sequence + penjelasan, tanpa kode):

`docs/Laporan_Bagian_2_Flow_Sistem.docx`

Empat flow, masing-masing satu sequence diagram utuh.

1. Autentikasi — daftar, masuk, sesi, keluar
2. Alur data — permintaan berhasil atau ditolak
3. Sewa jasa — minta, bayar, kerjakan, cair / sengketa
4. Lowongan — pasang, lamar, terima satu orang, atau tutup

Generate ulang:

```
set DIAGRAMS_ONLY=1
set FLOW_ONLY=1
node docs/capture_laporan.mjs
python docs/build_bagian2_flow.py
```
