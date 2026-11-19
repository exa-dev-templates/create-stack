---
title: React 19 Template
description: Arsitektur, state management Zustand, PrimeReact, dan best practice di template-react
---

import { Badge } from '@astrojs/starlight/components';

Template `template-react` adalah starter kit dashboard SaaS enterprise berbasis **React 19** dan **Vite**, dirancang untuk performa tinggi, modularitas, dan kepatuhan penuh terhadap standar desain monorepo.

---

## 🚀 Tech Stack

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **Framework** | React 19 | Hooks, Concurrent Features |
| **Bundler** | Vite 5/6 | Lightning-fast HMR |
| **Bahasa** | TypeScript | Strict Type Checking |
| **Styling** | Tailwind CSS v4 | Zero-config CSS build |
| **Komponen UI** | PrimeReact (Aura) | DataTable, Dialog, Toast, Button |
| **State Management** | Zustand | Atomic, boilerplate-free store |
| **Routing** | React Router v6 | Nested layouts & protected routes |
| **HTTP Client** | Axios | Request/Response interceptors & token refresh |
| **Port Dev** | `5173` | [http://localhost:5173](http://localhost:5173) |

---

## ⚡ Contoh State Management (Zustand)

Zustand digunakan karena ringan, tanpa boilerplate Context API, dan memiliki performa re-render yang terisolasi:

```typescript title="src/stores/authStore.ts"
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth-storage' }
  )
);
```

---

## 🛡️ Implementasi Skeleton Loading

Sesuai aturan arsitektur monorepo, tabel dan card menampilkan skeleton loader saat data dimuat:

```tsx title="src/features/users/UserList.tsx"
import React from 'react';
import { Skeleton } from 'primereact/skeleton';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

export const UserList = ({ users, isLoading }: { users: any[]; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton height="3rem" className="rounded-lg" />
        <Skeleton height="2.5rem" className="rounded-md" />
        <Skeleton height="2.5rem" className="rounded-md" />
        <Skeleton height="2.5rem" className="rounded-md" />
      </div>
    );
  }

  return (
    <DataTable value={users} className="p-datatable-sm">
      <Column field="name" header="Name" />
      <Column field="email" header="Email" />
      <Column field="role" header="Role" />
    </DataTable>
  );
};
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd frontend

# Install dependensi
npm install

# Jalankan development server (port 5173)
npm run dev

# Jalankan linter dan type check
npm run lint

# Build untuk produksi
npm run build
```
