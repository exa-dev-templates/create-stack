---
title: Panduan Kilat (Quickstart)
description: Cara menjalankan CLI scaffolding dan membuat project pertama Anda
---

import { Tabs, TabItem } from '@astrojs/starlight/components';

Ada 3 cara untuk menjalankan generator `@exa31/create-stack`:

<Tabs>
  <TabItem label="🚀 1. NPX (Rekomendasi)">
    Buka terminal di folder mana saja (tanpa perlu clone repo ini):

    ```bash title="Terminal"
    npx @exa31/create-stack
    ```

    *Package ini otomatis mengunduh versi rilis terbaru dari NPM dan menjalankan wizard interaktif.*
  </TabItem>
  <TabItem label="💻 2. Pengembangan Lokal">
    Jika Anda sedang mengembangkan template atau CLI di dalam repo ini:

    ```bash title="Terminal"
    # Jalankan generator interaktif
    npm run create
    # atau
    npm start
    ```
  </TabItem>
  <TabItem label="🌐 3. Command Global">
    Jika ingin membuat perintah `create-stack` tersedia secara global di terminal Anda:

    ```bash title="Terminal"
    npm run link-cli

    # Sekarang bisa dipanggil dari direktori mana saja:
    create-stack
    ```
  </TabItem>
</Tabs>

---

## 📋 Prasyarat Sistem

Sebelum menjalankan proyek yang di-generate, pastikan mesin Anda memiliki:
- **Node.js**: Versi 18+ (Node 20+ LTS sangat disarankan).
- **Docker & Docker Compose**: Untuk menjalankan service database lokal, Redis, RabbitMQ, Kafka, dan Mailpit.
- **Git**: Untuk inisialisasi repositori otomatis.

---

## 🏃 Langkah Pertama Setelah Scaffolding

Setelah CLI selesai membuat project Anda, ikuti langkah berikut:

```bash title="Terminal"
# 1. Masuk ke folder project baru
cd my-awesome-app

# 2. Jalankan infrastruktur pendukung lokal (Docker)
npm run infra:up

# 3. Jalankan seluruh service (Frontend, Backend, Worker) sekaligus
npm run dev:all
```

Akses Web UI bawaan di browser Anda:
- 🎨 **Frontend**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend API**: [http://localhost:5000](http://localhost:5000) (Express) / [http://localhost:8000](http://localhost:8000) (FastAPI) / [http://localhost:8080](http://localhost:8080) (Go/Java/Rust)
- 🐰 **RabbitMQ Dashboard**: [http://localhost:15672](http://localhost:15672) (User/Pass: `guest`/`guest`)
- ⚡ **Kafka UI Dashboard**: [http://localhost:8085](http://localhost:8085)
- 📬 **Mailpit Webmail**: [http://localhost:8025](http://localhost:8025)
