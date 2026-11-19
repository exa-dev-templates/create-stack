---
title: React 19 Template
description: Architecture, Zustand state management, PrimeReact, and conventions in template-react
---

import { Badge } from '@astrojs/starlight/components';

The `template-react` starter kit is an enterprise SaaS dashboard template built with **React 19** and **Vite**, engineered for high performance, strict typing, and full compliance with monorepo standards.

---

## 🚀 Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Framework** | React 19 | Modern hooks & concurrent features |
| **Bundler** | Vite 5/6 | Near-instant HMR |
| **Language** | TypeScript | Strict type checking enabled |
| **Styling** | Tailwind CSS v4 | Zero-config CSS builds |
| **UI Components** | PrimeReact (Aura) | Accessible DataTable, Dialog, Toast, Button |
| **State Management** | Zustand | Atomic, boilerplate-free state stores |
| **Routing** | React Router v6 | Nested layouts & auth-guarded routes |
| **HTTP Client** | Axios | Token refresh & request/response interceptors |
| **Dev Port** | `5173` | [http://localhost:5173](http://localhost:5173) |

---

## ⚡ State Management Example (Zustand)

Zustand provides scalable, hook-based state management without the re-render overhead of React Context:

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

## 🛡️ Skeleton Loading Implementation

Per monorepo rules, async data states render skeletons instead of circular spinners:

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

## 🛠️ Development Workflow

```bash title="Terminal"
cd frontend

# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Run linter and typecheck
npm run lint

# Build for production
npm run build
```
