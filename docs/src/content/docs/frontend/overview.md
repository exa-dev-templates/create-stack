---
title: Standar & Arsitektur Frontend
description: Panduan arsitektur feature-sliced, Tailwind CSS v4, dan aturan skeleton loader
---

Kedua template frontend (`template-react` dan `template-vue`) dibangun di atas standar arsitektur yang konsisten, modern, dan modular.

---

## 📂 Modular & Feature-Sliced Architecture

Kode client diorganisasikan berdasarkan domain fitur untuk menjaga skalabilitas aplikasi saat basis kode berkembang besar:

```text
src/
├── api/             # API client & endpoint terisolasi per domain (misal: users.ts, auth.ts)
├── assets/          # Static assets (gambar, font, global CSS)
├── components/      # UI components global & reusable
│   └── layout/      # Sidebar, Header, Breadcrumbs
├── features/        # Komponen spesifik domain fitur (misal: features/users/UserTable.tsx)
├── layouts/         # Wrapper tata letak halaman (DashboardLayout, AuthLayout)
├── pages/           # View level routing (DashboardPage, ProfilePage)
├── stores/          # State management global (Zustand di React / Pinia di Vue)
├── types/           # TypeScript interfaces, types, dan DTOs
└── utils/           # Helper functions murni (formatting uang, tanggal, cn)
```

> **Catatan Barrel Exports**: Setiap direktori utama memiliki `index.ts` (Barrel Export). Ini memungkinkan impor yang ringkas dan bersih, misalnya:
> ```ts
> import { formatCurrency, cn } from '@/utils';
> import { useUserStore } from '@/stores';
> ```

---

## 🎨 Design System & Styling
- **Tailwind CSS v4**: Utility-first CSS engine terbaru dengan performa compile instan.
- **Prime UI (Aura Theme)**: PrimeReact / PrimeVue dijalankan dalam mode modern *Aura Theme*, memberikan komponen enterprise (DataTable, Dialog, Toast, Dropdown) yang elegan dan responsif.
- **Dark Mode Support**: Terintegrasi langsung dengan toggle tema dan kelas `.dark`.

---

## 🛡️ Aturan Wajib: Skeleton Loader (Dilarang Loading Muter)

Sesuai aturan monorepo (`frontend-loading.md`):

- ❌ **DILARANG KERAS**: Menggunakan spinner berputar (*circular spinner / loading muter*) untuk memuat konten halaman, kartu profil, atau tabel data.
- ✅ **WAJIB SKELETON**: Setiap proses fetching data asinkron wajib menampilkan **Skeleton Placeholder** yang merefleksikan bentuk layout konten asli.
- ✅ **Pengecualian Spinner**: Spinner berputar **HANYA** diizinkan di dalam elemen `<Button>` saat aksi pengguna (Submit, Simpan, Hapus) sedang berlangsung.
