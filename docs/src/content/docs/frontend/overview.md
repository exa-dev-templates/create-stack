---
title: Standar & Arsitektur Frontend
description: Panduan arsitektur feature-driven modules, Axios interceptors, Tailwind CSS v4, dan aturan skeleton loader
---

Kedua template frontend (`template-react` dan `template-vue`) dibangun di atas standar arsitektur enterprise yang konsisten, modern, modular, dan berperforma tinggi.

---

## 📂 Modular & Feature-Driven Architecture

Kode client diorganisasikan berdasarkan domain fitur (*feature modules*) untuk menjaga skalabilitas aplikasi saat basis kode berkembang besar:

```text
src/
├── api/             # Central Axios client (client.ts), interceptors, token refresh queue
├── assets/          # Static assets (gambar, font, global CSS)
├── components/      # UI components global & reusable (ErrorBoundary, ToastProvider)
│   └── layout/      # Sidebar, Header, Breadcrumbs
├── layouts/         # Wrapper tata letak halaman (DashboardLayout, AuthLayout)
├── modules/         # Feature modules terisolasi per domain bisnis
│   ├── auth/        # Login, Register, auth store, types, API
│   ├── dashboard/   # Dashboard widgets, metric cards
│   └── users/       # DataTable user, dialog, usersApi
├── pages/           # Root view-level routing (NotFound, fallback)
├── stores/          # State management global (Zustand di React / Pinia di Vue)
├── types/           # TypeScript interfaces, types, dan standard envelopes
└── utils/           # Helper functions murni (native cookies, formatting uang/tanggal, logger)
```

> **Catatan Barrel Exports**: Setiap direktori utama dan modul fitur memiliki `index.ts` (Barrel Export). Ini memungkinkan impor yang ringkas dan bersih, misalnya:
> ```ts
> import { apiClient } from '@/api';
> import { useAuthStore } from '@/modules/auth';
> import { usersApi } from '@/modules/users';
> import { getCookie, formatCurrency } from '@/utils';
> ```

---

## 🌐 Enterprise HTTP Client & Token Rotation

Seluruh request API melalui Axios instance terpusat (`src/api/client.ts`):
- **Bearer Token Auto-Injection**: Membaca access token dari cookie browser secara native tanpa library luar.
- **Concurrent Request Queuing on 401**: Saat token kedaluwarsa, seluruh request paralel ditampung dalam antrean `failedQueue` sementara refresh token diputar ke `/auth/refresh`. Setelah sukses, semua request otomatis di-replay tanpa kegagalan di sisi user.
- **Global Toast Event Bridge**: Error jaringan atau HTTP 4xx/5xx otomatis memicu toast notifikasi global via window event `api:toast`, dapat dinonaktifkan per request dengan opsi `{ skipToast: true }`.

---

## 🎨 Design System & Styling

- **Tailwind CSS v4**: Utility-first CSS engine terbaru dengan performa compile instan via `@tailwindcss/vite`.
- **Prime UI (Aura Theme)**: PrimeReact / PrimeVue dijalankan dalam mode modern *Aura Theme* (`@primeuix/themes/aura`), memberikan komponen enterprise (DataTable, Dialog, Toast, Form Inputs) yang elegan dan responsif.
- **CSS Cascade Layer Order**: Diatur agar utility class Tailwind v4 selalu meng-override styling komponen Prime UI (`order: 'tailwind-base, primereact/primevue, tailwind-utilities'`).
- **Dark Mode Support**: Terintegrasi langsung dengan toggle tema dan kelas `.dark`.

---

## 🛡️ Aturan Wajib: Skeleton Loader (Dilarang Loading Muter)

Sesuai aturan monorepo (`frontend-loading.md`):

- ❌ **DILARANG KERAS**: Menggunakan spinner berputar (*circular spinner / loading muter*) untuk memuat konten halaman, kartu profil, atau tabel data.
- ✅ **WAJIB SKELETON**: Setiap proses fetching data asinkron wajib menampilkan **Skeleton Placeholder** yang merefleksikan bentuk layout konten asli.
- ✅ **Pengecualian Spinner**: Spinner berputar **HANYA** diizinkan di dalam elemen `<Button loading={...}>` saat aksi pengguna (Submit, Simpan, Hapus) sedang berlangsung.
