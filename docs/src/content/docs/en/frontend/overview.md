---
title: Frontend Standards & Architecture
description: Feature-driven module architecture, Axios interceptors, Tailwind CSS v4, and skeleton loader guidelines
---

Both frontend templates (`template-react` and `template-vue`) are built upon a consistent, modern, modular, and high-performance enterprise architecture.

---

## 📂 Modular & Feature-Driven Architecture

Client code is partitioned into domain-specific modules (*feature modules*) to ensure seamless scalability as codebases grow:

```text
src/
├── api/             # Central Axios client (client.ts), interceptors, token refresh queue
├── assets/          # Static assets (images, fonts, global CSS)
├── components/      # Global & reusable UI components (ErrorBoundary, ToastProvider)
│   └── layout/      # Sidebar, Header, Breadcrumbs
├── layouts/         # Layout shells (DashboardLayout, AuthLayout)
├── modules/         # Encapsulated feature modules per business domain
│   ├── auth/        # Login, Register, auth store, types, API
│   ├── dashboard/   # Dashboard widgets, metric cards
│   └── users/       # User DataTable, dialog, usersApi
├── pages/           # Root view-level routing (NotFound, fallback)
├── stores/          # Global state management (Zustand in React / Pinia in Vue)
├── types/           # TypeScript interfaces, types, and standard envelopes
└── utils/           # Pure utility helpers (native cookies, formatters, logger)
```

> **Barrel Exports Pattern**: Every primary directory and feature module exports a public `index.ts`. This encourages clean, unbloated imports:
> ```ts
> import { apiClient } from '@/api';
> import { useAuthStore } from '@/modules/auth';
> import { usersApi } from '@/modules/users';
> import { getCookie, formatCurrency } from '@/utils';
> ```

---

## 🌐 Enterprise HTTP Client & Token Rotation

All REST API operations flow through the centralized Axios client (`src/api/client.ts`):
- **Bearer Token Auto-Injection**: Extracts browser access token cookies natively without external library bloat.
- **Concurrent Request Queuing on 401**: When access tokens expire, incoming requests are buffered into `failedQueue` while the refresh token executes against `/auth/refresh`. Once rotated, buffered requests are replayed transparently.
- **Global Toast Event Bridge**: Network anomalies or 4xx/5xx HTTP responses automatically broadcast an `api:toast` window event, suppressible per request via `{ skipToast: true }`.

---

## 🎨 Design System & Styling

- **Tailwind CSS v4**: Zero-config CSS build via `@tailwindcss/vite` with instant HMR compilation.
- **Prime UI (Aura Theme)**: PrimeReact / PrimeVue powered by `@primeuix/themes/aura`, delivering enterprise-grade components (DataTable, Dialog, Toast, Form Inputs).
- **CSS Cascade Layer Order**: Strictly configured so Tailwind utilities take precedence over Prime UI defaults (`order: 'tailwind-base, primereact/primevue, tailwind-utilities'`).
- **Dark Mode Support**: Native dark mode activation via `.dark` class targeting the root `<html>` element.

---

## 🛡️ Mandatory Rule: Skeleton Loaders (Zero Spinner Policy)

Enforcing monorepo standards (`frontend-loading.md`):

- ❌ **STRICTLY FORBIDDEN**: Using circular spinners ("loading muter") for page transitions, profile cards, or data tables.
- ✅ **MANDATORY SKELETON**: Every asynchronous data fetch must display geometrically proportional **Skeleton Placeholders**.
- ✅ **Button Spinner Exception**: Circular spinners are permitted **EXCLUSIVELY** within `<Button loading={...}>` components during active user actions (Submit, Save, Delete).
