---
title: Opsi & Prompt CLI
description: Panduan langkah demi langkah pada wizard interaktif @exa31/create-stack
---

import { Badge } from '@astrojs/starlight/components';

Saat Anda menjalankan `npx @exa31/create-stack`, wizard interaktif berbasis `@clack/prompts` akan memandu Anda melalui serangkaian pertanyaan berikut:

---

### 1. Nama Project (`projectName`)
- **Pertanyaan**: `Nama project:`
- **Validasi**: Wajib karakter URL-friendly (huruf kecil, angka, dan tanda hubung `-`). Tidak boleh diawali titik atau tanda hubung.
- **Contoh**: `my-saas-platform`

---

### 2. Pilihan Mode (`mode`)
- **Fullstack Project (FE + BE + Worker)**: Menggabungkan beberapa service ke dalam satu workspace.
- **Single Component / Service**: Menghasilkan satu komponen standalone langsung di root direktori.

---

### 3. Pemilihan Service
- **Frontend**:
  - `React 19 (Vite + Tailwind v4 + PrimeReact)`
  - `Vue 3 (Vite + Tailwind v4 + PrimeVue)`
  - `Skip Frontend`
- **Backend**:
  - `Express.js (TypeScript + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `FastAPI (Python Async + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Golang (Fiber + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Java (Spring Boot 4 + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Rust (Axum + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Skip Backend`
- **Worker (Opsional)**:
  - `Golang Worker (RabbitMQ/Kafka Consumer)`
  - `Java Worker (Spring Boot RabbitMQ/Kafka Consumer)`
  - `Python Worker (RabbitMQ/Kafka Consumer)`
  - `TypeScript Worker (Node.js RabbitMQ/Kafka Consumer)`
  - `Rust Worker (Axum/Lapin RabbitMQ/Kafka Consumer)`
  - `Skip Worker`

---

### 4. Database Utama <Badge text="Baru" variant="tip" />
- **PostgreSQL (Default)**: Port default `5432`.
- **MySQL 8.4**: Port default `3306`.
  - *Otomasi CLI*: Jika memilih MySQL, CLI otomatis menyesuaikan konfigurasi `.env`, driver backend, dan service container MySQL di `docker-compose.infra.yml`.

---

### 5. Message Broker / Event Streaming <Badge text="Baru" variant="tip" />
Jika memilih Backend atau Worker, CLI menanyakan pilihan broker:
- **🐰 + ⚡ Both (RabbitMQ + Apache Kafka)**: Menyediakan RabbitMQ untuk RPC/Queue task ringan, dan Kafka KRaft untuk event streaming terdistribusi.
- **🐰 RabbitMQ 3**: AMQP queue dengan dashboard manajemen di port `15672`.
- **⚡ Apache Kafka (KRaft)**: High-throughput distributed streaming dengan Kafka UI di port `8085`.
- **🚫 Tanpa Message Broker**: Nonaktifkan messaging jika aplikasi hanya butuh REST API murni.

---

### 6. Environment & Git Initialization
- **Generate `.env`**: Meng-copy seluruh file `.env.example` menjadi `.env` aktif dan menyesuaikan kredensial database.
- **Inisialisasi Git**: Menjalankan `git init` dan membuat initial commit otomatis.
