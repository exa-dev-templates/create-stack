---
title: Frontend Standards & Architecture
description: Feature-driven module architecture, Axios interceptors, Tailwind CSS v4, and skeleton loader guidelines
---

Both frontend templates (`template-react` and `template-vue`) are built upon a consistent, modern, modular, and high-performance enterprise architecture.

---

## 📊 Feature & Parity Matrix

| Architecture Dimension | React 19 (`template-react`) | Vue 3 (`template-vue`) |
| :--- | :--- | :--- |
| **Framework & Version** | React 19 + TypeScript (Strict) | Vue 3 (`<script setup lang="ts">`) |
| **Build Tooling** | Vite 6 + `@vitejs/plugin-react` | Vite 6 + `@vitejs/plugin-vue` |
| **CSS Engine** | Tailwind CSS v4 (`@tailwindcss/vite`) | Tailwind CSS v4 (`@tailwindcss/vite`) |
| **UI Components** | PrimeReact (Aura Theme Preset) | PrimeVue (Aura Theme Preset) |
| **State Management** | Zustand 5 | Pinia 3 (Setup Stores Pattern) |
| **Routing** | React Router v7 (`createBrowserRouter`) | Vue Router 4 (`createRouter`) |
| **Enterprise HTTP Client** | Axios + Bearer Cookie Auto-Injection | Axios + Bearer Cookie Auto-Injection |
| **Token Refresh Queue** | Concurrency-safe 401 buffer (`failedQueue`) | Concurrency-safe 401 buffer (`failedQueue`) |
| **Idempotency Protection** | Native Web Crypto UUID v4 + `useIdempotencyKey` | Native Web Crypto UUID v4 + `useIdempotencyKey` |
| **Full-Duplex WebSocket** | `useWebSocket` (Heartbeat watchdog + Reconnect Jitter) | `useWebSocket` (Heartbeat watchdog + Reconnect Jitter) |
| **Server-Sent Events (SSE)** | `useSSE` (`withCredentials: true` + Custom Events) | `useSSE` (`withCredentials: true` + Custom Events) |
| **Loading Policy** | Mandatory Skeleton Loader (Zero Spinner Policy) | Mandatory Skeleton Loader (Zero Spinner Policy) |

---

## 📂 Modular & Feature-Driven Architecture

Client code is partitioned into domain-specific modules (*feature modules*) to ensure seamless scalability as codebases grow:

```text
src/
├── api/             # Central Axios client (client.ts), interceptors, token refresh queue
├── assets/          # Static assets (images, fonts, global CSS)
├── components/      # Global & reusable UI components (ErrorBoundary, ToastProvider)
│   └── layout/      # Sidebar, Header, Breadcrumbs
├── hooks/           # (React) Custom hooks (useWebSocket, useSSE, useIdempotencyKey, useDarkMode)
├── composables/     # (Vue) Composables (useWebSocket, useSSE, useIdempotencyKey, useDarkMode)
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
- **Idempotency Protection & Resilient Mutation Lifecycle (`useIdempotencyKey`)**: Automatically injects standard `Idempotency-Key` and `X-Idempotency-Key` headers via `{ idempotencyKey: true | string }`. The `useIdempotencyKey` lifecycle hook/composable secures mutations against F5 browser reloads via `sessionStorage`, retains the key during timeouts and retries, and automatically cycles to a fresh key upon 2xx success.

---

## ⚡ Real-Time Streaming: WebSocket & Server-Sent Events (SSE)

Both frontend templates provide production-grade, *Native-First & Zero-Bloat* real-time utilities (zero third-party dependencies like `socket.io-client` or `event-source-polyfill` per Monorepo Rule E), designed for seamless integration with the backend distributed real-time engine (`REALTIME_BRIDGE=redis|rabbitmq|both|local`):

- **Full-Duplex WebSocket (`useWebSocket`)**:
  - Auto-reconnect with exponential backoff and random jitter to guard backend clusters against thundering herds.
  - Built-in ping/pong heartbeat watchdog keep-alive to actively detect and purge half-open sockets.
  - Automatic JSON serialization on dispatch (`send(...)`) and deserialization on reception (`onMessage`).
  - Automatic unmount lifecycle cleanup ensuring sockets close safely during route transitions.
- **Server-Sent Events (`useSSE`)**:
  - Reactive unidirectional data streaming with automated JSON payload parsing.
  - Cross-origin HTTP-only session cookie forwarding via `{ withCredentials: true }`.
  - Multi-channel event listeners via array configuration: `events: ['order_status', 'system_alert']`.
  - Fully SSR-safe execution preventing hydration mismatches in hybrid SSR environments (Next.js / Nuxt 3/4).

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
