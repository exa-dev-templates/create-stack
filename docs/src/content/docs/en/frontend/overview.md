---
title: Frontend Standards & Architecture
description: Feature-sliced architecture, Tailwind CSS v4, and the strict skeleton loading rule
---

Both frontend templates (`template-react` and `template-vue`) are built on consistent, modular, and domain-driven design principles.

---

## 📂 Modular & Feature-Sliced Architecture

Client code is organized by feature domains to maintain maintainability as the application grows:

```text
src/
├── api/             # Domain-specific API clients (e.g. users.ts, auth.ts)
├── assets/          # Static assets (images, fonts, global CSS)
├── components/      # Shared global UI components
│   └── layout/      # Sidebar, Header, Breadcrumbs
├── features/        # Feature-specific components (e.g. features/users/UserTable.tsx)
├── layouts/         # Page layout wrappers (DashboardLayout, AuthLayout)
├── pages/           # Route-level views (DashboardPage, ProfilePage)
├── stores/          # Global state management (Zustand in React / Pinia in Vue)
├── types/           # TypeScript interfaces, types, and DTOs
└── utils/           # Pure utility functions (currency formatting, date helpers, cn)
```

> **Barrel Export Convention**: Every major folder includes an `index.ts`. This facilitates clean, concise imports:
> ```ts
> import { formatCurrency, cn } from '@/utils';
> import { useUserStore } from '@/stores';
> ```

---

## 🎨 Design System & Styling
- **Tailwind CSS v4**: Next-generation utility-first CSS compiler with instant build times.
- **Prime UI (Aura Theme)**: PrimeReact / PrimeVue styled with the modern *Aura Theme*, delivering accessible, enterprise-grade components (DataTable, Modal, Toast, Dropdown).
- **Dark Mode Native**: Complete light/dark theme switching powered by Tailwind's `.dark` class.

---

## 🛡️ Mandatory Rule: Skeleton Loading (No Circular Spinners)

Per monorepo standard (`frontend-loading.md`):

- ❌ **STRICTLY PROHIBITED**: Using circular loading spinners for page loading, profile views, card grids, or data tables.
- ✅ **MANDATORY SKELETON**: Every asynchronous data fetch must present **Skeleton Loaders** that mimic the layout of the loaded content.
- ✅ **Spinner Exception**: Circular spinners are permitted **ONLY** inside action `<Button>` components while an action (Submit, Save, Delete) is actively processing.
