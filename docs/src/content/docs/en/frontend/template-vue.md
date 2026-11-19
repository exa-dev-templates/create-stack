---
title: Vue 3 Template
description: Composition API architecture, Pinia setup stores, PrimeVue, and conventions in template-vue
---

The `template-vue` starter kit is an enterprise SaaS dashboard template built with **Vue 3** (Composition API with `<script setup lang="ts">`) and **Vite**, prioritizing performance, DX, and strict alignment with monorepo standards.

---

## 🚀 Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Framework** | Vue 3 | Composition API & `<script setup>` |
| **Bundler** | Vite 5/6 | Fast HMR & optimized chunks |
| **Language** | TypeScript | Strict type checking enabled |
| **Styling** | Tailwind CSS v4 | Zero-config modern CSS engine |
| **UI Components** | PrimeVue (Aura) | Accessible DataTable, Dialog, Toast, Button |
| **State Management** | Pinia | Modern Setup Stores (`ref`, `computed`, functions) |
| **Routing** | Vue Router 4 | Route guards & nested layouts |
| **HTTP Client** | Axios | Token refresh & request/response interceptors |
| **Dev Port** | `5173` | [http://localhost:5173](http://localhost:5173) |

---

## ⚡ State Management Example (Pinia Setup Store)

Stores are structured using the modern **Setup Store** syntax:

```typescript title="src/stores/auth.ts"
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  function setAuth(newUser: User, newToken: string) {
    user.value = newUser;
    token.value = newToken;
  }

  function logout() {
    user.value = null;
    token.value = null;
  }

  return { user, token, isAuthenticated, setAuth, logout };
});
```

---

## 🛡️ Skeleton Loading Implementation

Example component adhering to the monorepo skeleton rule:

```vue title="src/features/users/UserList.vue"
<script setup lang="ts">
import Skeleton from 'primevue/skeleton';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

defineProps<{
  users: Array<{ id: string; name: string; email: string }>;
  isLoading: boolean;
}>();
</script>

<template>
  <div v-if="isLoading" class="space-y-3">
    <Skeleton height="3rem" class="rounded-lg" />
    <Skeleton height="2.5rem" class="rounded-md" />
    <Skeleton height="2.5rem" class="rounded-md" />
  </div>

  <DataTable v-else :value="users" class="p-datatable-sm">
    <Column field="name" header="Name" />
    <Column field="email" header="Email" />
  </DataTable>
</template>
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Run linter and typecheck
npm run lint

# Build for production
npm run build
```
