---
title: Vue 3 Template
description: Arsitektur Composition API, Pinia setup stores, PrimeVue, dan best practice di template-vue
---

Template `template-vue` adalah starter kit dashboard enterprise berbasis **Vue 3** (Composition API dengan `<script setup lang="ts">`) dan **Vite**, mengedepankan performa tinggi, DX modern, dan kepatuhan penuh terhadap standar monorepo.

---

## 🚀 Tech Stack

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **Framework** | Vue 3 | Composition API & `<script setup>` |
| **Bundler** | Vite 5/6 | Fast HMR & optimized chunks |
| **Bahasa** | TypeScript | Strict type checking |
| **Styling** | Tailwind CSS v4 | Zero-config CSS builds |
| **Komponen UI** | PrimeVue (Aura) | DataTable, Dialog, Toast, Button |
| **State Management** | Pinia | Setup Stores (`ref`, `computed`, `function`) |
| **Routing** | Vue Router 4 | Route guards & nested layouts |
| **HTTP Client** | Axios | Request/Response interceptors & token refresh |
| **Dev Port** | `5173` | [http://localhost:5173](http://localhost:5173) |

---

## ⚡ Contoh State Management (Pinia Setup Store)

Pinia dikonfigurasi menggunakan pola **Setup Store** (seperti fungsi komposabel):

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

## 🛡️ Implementasi Skeleton Loading

Contoh komponen view yang patuh pada aturan skeleton loader:

```vue title="src/features/users/UserList.vue"
<script setup lang="ts">
import Skeleton from 'primereact/skeleton'; // or primevue/skeleton
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

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd frontend

# Install dependensi
npm install

# Jalankan server development
npm run dev

# Jalankan linter dan type check
npm run lint

# Build untuk produksi
npm run build
```
