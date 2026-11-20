---
title: Vue 3 Template
description: Enterprise dashboard architecture, SFC <script setup lang="ts">, Axios interceptors, Pinia setup stores, PrimeVue Aura, and Tailwind CSS v4
---

The `template-vue` template is an enterprise-grade SaaS dashboard starter kit built on **Vue 3** and **Vite**, engineered for high reactivity performance via Single File Components (`<script setup lang="ts">`), domain-driven modularity (*feature-driven modules*), resilient authentication handling via Axios interceptors, and seamless integration with PrimeVue Aura and Tailwind CSS v4.

---

## 🚀 Tech Stack & Core Specifications

| Component | Technology | Description & Version |
|---|---|---|
| **UI Framework** | Vue 3 | Reactivity engine, `<script setup lang="ts">`, SFC compiler (`3.5+`) |
| **Build Tool & Bundler** | Vite 8 | Lightning-fast HMR, `vite-plugin-vue-devtools` (`8.1+`) |
| **Language & Compiler** | TypeScript 6 | Strict type-safety, path aliases (`@/*`), `vue-tsc -b` (`~6.0`) |
| **Styling Engine** | Tailwind CSS v4 | Zero-config CSS build via `@tailwindcss/vite` (`4.3+`) |
| **Enterprise UI Kit** | PrimeVue 4 | DataTable, Dialog, Toast, Form Inputs, Button (`4.5+`) |
| **UI Theme Preset** | Aura (`@primeuix/themes`) | Modern minimalist enterprise design with CSS cascade layers |
| **State Management** | Pinia 3 | Composable setup stores (`defineStore`), zero mutation boilerplate (`3.0+`) |
| **Client Routing** | Vue Router 5 | Nested layouts, dynamic imports, navigation guards (`5.1+`) |
| **HTTP Client** | Axios 1.21+ | Auto-refresh token on 401, concurrent request queue, global toast |
| **Development Port** | `5173` | Default URL: [http://localhost:5173](http://localhost:5173) |

---

## 🌐 Enterprise HTTP Client (Axios & Token Refresh)

REST API communication is centralized in `src/api/client.ts`. This Axios client is engineered to manage JWT lifecycle transparently, including request queuing during active token rotation cycles.

```mermaid
flowchart TD
    Req["Client Request"] --> ReqInt["Request Interceptor\n(Inject Bearer Token from Cookie)"]
    ReqInt --> Backend["Backend API Gateway"]
    
    Backend -->|2xx Success| Res200["Response Interceptor\n(Deliver JSON Data)"]
    Backend -->|401 Unauthorized| Detect401{"Is Token Expired?"}
    
    Detect401 -->|Yes, Refresh Pending| CallRefresh["POST /auth/refresh\n(via isolated refreshClient)"]
    Detect401 -->|Refresh In-Flight| QueueReq["Queue in failedQueue[]\n(Awaiting New Token)"]
    
    CallRefresh -->|Refresh Succeeded| UpdateCookie["Update Cookie 'access_token'\n& Flush failedQueue[]"]
    UpdateCookie --> RetryReq["Automatically Replay Original Requests"]
    
    CallRefresh -->|Refresh Failed| ExpireSession["Purge Cookie, Fire 'auth:session-expired'\n& Display Session Expired Toast"]
```

### 1. Client Setup & Base Configuration

Configured with `withCredentials: true` for secure cookie transmission (*HTTP-only refresh token*):

```typescript title="src/api/client.ts"
import axios, { AxiosInstance } from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Dedicated unintercepted client for refresh requests to prevent recursion
const refreshClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});
```

### 2. Request Interceptor: Bearer Token Injection

Every outgoing request automatically attaches the browser access token cookie if the `Authorization` header is not explicitly present:

```typescript title="src/api/client.ts"
api.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      const accessToken = getCookie('access_token');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

### 3. Response Interceptor: 401 Queue & Auto-Refresh

Upon receiving an HTTP `401 Unauthorized` response, the interceptor locks the refresh cycle, appends incoming parallel requests to `failedQueue`, requests a new access token from `/auth/refresh`, and transparently replays all pending calls:

```typescript title="src/api/client.ts"
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;
    if (!originalRequest) return Promise.reject(error);

    const is401 = error.response?.status === 401;
    const isAuthEndpoint = originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login');

    if (!is401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (token && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await refreshClient.post('/auth/refresh');
      const newAccessToken = refreshResponse.data?.data?.tokens?.accessToken || getCookie('access_token');

      if (newAccessToken) {
        setCookie('access_token', newAccessToken);
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
      }

      processQueue(null, newAccessToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      removeCookie('access_token');
      window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: refreshError }));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
```

### 4. Global Toast Bridge & Error Handling

To avoid redundant UI toast boilerplate across API calls, the Axios interceptor dispatches a window event `api:toast` upon network disconnects or 4xx/5xx HTTP errors:

```typescript title="src/utils/toast.ts"
export interface ApiToastDetail {
  severity?: 'success' | 'info' | 'warn' | 'error';
  summary?: string;
  detail: string;
  life?: number;
}

export function dispatchToast(detail: ApiToastDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ApiToastDetail>('api:toast', { detail }));
  }
}
```

> **The `skipToast` Option**: For requests requiring custom inline error handling without global notifications, pass `{ skipToast: true }`:
> ```typescript
> await apiClient.get('/users/check-email', { skipToast: true });
> ```

---

## ⚡ Global State Management

The application leverages **Pinia 3** with the **Setup Stores** pattern (Composition API via `defineStore`), providing strict type inference and clean modular logic.

### 1. Store Definition (Zustand / Pinia)

```typescript title="src/modules/auth/stores/authStore.ts"
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from '@/modules/users';
import { removeCookie } from '@/utils';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => !!user.value);

  function login(userData: User) {
    user.value = userData;
  }

  function logout() {
    removeCookie('access_token');
    user.value = null;
  }

  return { user, isAuthenticated, login, logout };
});
```

### 2. Store Consumption in Components

Vue components access stores directly within `<script setup lang="ts">` with native reactivity:

```vue title="src/components/layout/Header.vue"
<script setup lang="ts">
import { useAuthStore } from '@/modules/auth';

const authStore = useAuthStore();
</script>

<template>
  <header class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
    <span class="text-sm font-medium">Logged in as: {{ authStore.user?.name || 'Guest' }}</span>
    <button @click="authStore.logout" class="text-sm text-red-500 hover:underline">
      Sign Out
    </button>
  </header>
</template>
```

---

## 🧭 Declarative Routing & Layout Modules

### 1. Router Configuration & Nested Layouts

Configured with `createRouter` from **Vue Router 5** using nested layout hierarchies and dynamic component imports:

```typescript title="src/router/index.ts"
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('@/modules/dashboard/pages/DashboardPage.vue')
        },
        {
          path: 'users',
          name: 'Users',
          component: () => import('@/modules/users/pages/UsersPage.vue')
        }
      ]
    },
    {
      path: '/auth',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: 'login',
          name: 'Login',
          component: () => import('@/modules/auth/pages/LoginPage.vue')
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/pages/NotFound.vue')
    }
  ]
});

export default router;
```

### 2. Feature-Driven Module Structure

All feature domains are encapsulated under `src/modules/<feature-name>/`:

```text
src/modules/users/
├── api/
│   └── usersApi.ts       # Domain-scoped Axios methods
├── components/
│   └── UserAvatar.vue    # User UI widgets
├── pages/
│   └── UsersPage.vue     # View route endpoint
├── types/
│   └── index.ts          # TypeScript entities
└── index.ts              # Public module barrel export
```

Example module API client using the enterprise Axios wrapper:

```typescript title="src/modules/users/api/usersApi.ts"
import { apiClient } from '@/api/client';
import type { PaginatedResponse } from '@/types';
import type { User } from '../types';

export const usersApi = {
  getAll: (page = 1, pageSize = 10) =>
    apiClient.get<PaginatedResponse<User>>(`/users?page=${page}&pageSize=${pageSize}`),

  getById: (id: string) =>
    apiClient.get<User>(`/users/${id}`),

  create: (data: Omit<User, 'id'>) =>
    apiClient.post<User>('/users', data),

  update: (id: string, data: Partial<User>) =>
    apiClient.put<User>(`/users/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<void>(`/users/${id}`)
};
```

---

## 🎨 UI System: PrimeUI & Tailwind CSS v4

### 1. Aura Theme Preset & CSS Layer Order

PrimeVue integrates the modern **Aura** preset from `@primeuix/themes`. Cascade layer orders are configured so that Tailwind v4 utilities retain highest precedence:

```typescript title="src/main.ts"
import Aura from '@primeuix/themes/aura';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities',
      },
    },
  },
});
app.use(ToastService);
```

### 2. Dark Mode Selector

Dark mode is driven by the `.dark` class on the root `<html>` element. PrimeVue components (such as `DataTable`, `Dialog`, and `InputText`) adapt color schemes dynamically.

---

## 🛡️ Loading Patterns: Skeleton Loaders vs Action Buttons

Adhering strictly to monorepo loading guidelines (`frontend-loading.md`):

### 1. Mandatory Skeleton Loaders for Async Data

❌ **STRICTLY FORBIDDEN**: Using circular spinners ("loading muter") for page transitions, `DataTable` loading, cards, or user lists.
✅ **MANDATORY SKELETON**: All asynchronous data fetching states must render geometrically proportional **Skeleton** placeholders:

```vue title="DataTable Skeleton Loader"
<script setup lang="ts">
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Skeleton from 'primevue/skeleton';

const dummyRows = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
</script>

<template>
  <DataTable :value="dummyRows" class="p-datatable-sm">
    <Column header="Name">
      <template #body><Skeleton width="70%" height="1.25rem" /></template>
    </Column>
    <Column header="Email">
      <template #body><Skeleton width="90%" height="1.25rem" /></template>
    </Column>
    <Column header="Role">
      <template #body><Skeleton width="40%" height="1.25rem" /></template>
    </Column>
    <Column header="Actions">
      <template #body><Skeleton shape="circle" size="2rem" /></template>
    </Column>
  </DataTable>
</template>
```

### 2. Interactive Button Spinners (Only Allowed Spinner)

✅ Circular spinners are permitted **EXCLUSIVELY** inside `<Button :loading="isSubmitting">` while processing an interactive user mutation (Form submit, Save, Delete):

```vue title="src/modules/auth/pages/LoginPage.vue"
<script setup lang="ts">
import Button from 'primevue/button';
import { ref } from 'vue';

const isSubmitting = ref(false);
</script>

<template>
  <Button 
    type="submit" 
    label="Sign in" 
    :loading="isSubmitting" 
    class="w-full bg-indigo-600 hover:bg-indigo-700 border-none mt-2" 
  />
</template>
```

---

## ⚙️ Environment Variables & Configuration

```ini title=".env"
# REST API Gateway Endpoint
VITE_API_BASE_URL=http://localhost:3000
```

---

## 🛠️ Development Commands & Quality Gates

```bash title="Terminal"
cd template-vue

# Install dependencies
npm install

# Run preflight security checks & launch local dev server (port 5173)
npm run dev

# Run Vue TypeScript typecheck (vue-tsc -b)
npm run typecheck

# Run ESLint with auto-fix
npm run lint

# Format code with Prettier
npm run format

# Run standalone preflight security audit (npm audit + typecheck)
npm run preflight

# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```
