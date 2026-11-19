---
title: Frontend Loading State & Skeleton Loaders
description: Aturan wajib penggunaan skeleton loader dan larangan spinner berputar pada halaman
---

Aturan ini berlaku wajib di seluruh template frontend (`template-react` dan `template-vue`).

---

## 🚫 Larangan Keras: Circular Loading Spinner ("Loading Muter")

❌ **DILARANG KERAS** menggunakan spinner berputar (circular progress indicator) untuk:
- Memuat halaman penuh (*full-page initial load*)
- Memuat tabel data (*DataTable*)
- Memuat daftar kartu (*Card list / grid*)
- Memuat formulir detail profil atau pengaturan

**Alasan UX**: Circular spinner menyebabkan *Cumulative Layout Shift* (CLS) tinggi dan membuat aplikasi terasa lambat serta tidak profesional.

---

## ✅ Wajib: Skeleton Loader Placeholder

Setiap pemuatan data asinkron wajib menampilkan **Skeleton Placeholder** yang merepresentasikan bentuk akhir dari konten yang sedang diambil:
- Untuk tabel: Tampilkan deretan garis baris skeleton.
- Untuk kartu profil: Tampilkan lingkaran skeleton untuk avatar dan garis skeleton untuk nama/jabatan.
- Untuk grafik: Tampilkan kotak skeleton dengan dimensi yang sama.

---

## ✅ Pengecualian: Spinner pada Tombol Aksi

Spinner kecil **HANYA** diizinkan di dalam elemen tombol (`<Button loading={isSubmitting} />`) saat tombol ditekan dan aksi pengguna (Submit, Simpan, Update, Hapus) sedang diproses oleh backend.
