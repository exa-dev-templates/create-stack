---
title: Pengenalan
description: Mengapa @exa31/create-stack dan ekosistem template ini diciptakan
---

## 🎯 Mengapa @exa31/create-stack?

Memulai proyek baru di lingkungan enterprise seringkali memakan waktu berhari-hari hanya untuk menyiapkan *boilerplate*:
- Mengonfigurasi struktur folder yang rapi (*Clean Architecture*).
- Menyiapkan koneksi database dengan *connection pooling* dan transaksi yang aman.
- Menghubungkan *caching layer* (Redis) dan *message broker* (RabbitMQ / Kafka).
- Menstandarkan format error, logger terstruktur (JSON), dan autentikasi JWT.
- Menyiapkan *environment parity* antara database lokal dan produksi.
- Mengajari *AI coding assistant* (seperti Antigravity, Claude Code, Cursor) tentang aturan arsitektur tim.

**`@exa31/create-stack`** memecahkan masalah ini dengan menyediakan generator scaffolding interaktif satu perintah yang mengekstrak template arsitektur produksi yang telah teruji, terstandarisasi, dan bebas dari celah keamanan.

---

## 🏗️ Ekosistem Monorepo

Monorepo ini menampung 12 template starter kit mandiri:

### 🎨 Frontend
- **React 19 (`template-react`)**: Vite, TypeScript, Tailwind CSS v4, PrimeReact (Aura theme), Zustand, React Router v6.
- **Vue 3 (`template-vue`)**: Vite, TypeScript, Tailwind CSS v4, PrimeVue (Aura theme), Pinia, Vue Router.

### ⚙️ Backend
- **Express.js (`template-express`)**: Node.js, TypeScript, Clean Architecture, Zod, Winston JSON logging, OpenAPI 3.0.
- **FastAPI Async (`template-fastapi-async`)**: Python 3.10+, asyncpg/SQLAlchemy (raw SQL queries), Pydantic v2, Alembic, OpenAPI 3.0.
- **Go Fiber (`template-golang`)**: Go 1.22+, Fiber v2, sqlx raw queries, pure parameter passing `tx *sqlx.Tx`, slog JSON logging, Swagger.
- **Spring Boot (`template-java`)**: Java 17+, Spring Boot 4, Liquibase UP/DOWN, JPA, JWT `@RequireAuth`, Swagger UI.
- **Rust Axum (`template-rust`)**: Rust 2021, Axum 0.7, SQLx compile-time query safety, `tracing` JSON logging, Argon2id, Swagger UI.

### 🔄 Worker / Queue Consumers
- **Go Worker (`template-worker-golang`)**: Consumer RabbitMQ & Kafka dengan QoS prefetch, manual Ack/Nack, dan graceful shutdown.
- **Java Worker (`template-worker-java`)**: Spring AMQP `@RabbitListener` dan Kafka listener.
- **Python Worker (`template-worker-python`)**: Async consumer dengan Pika / aio-pika / Kafka.
- **TypeScript Worker (`template-worker-typescript`)**: Node.js worker dengan amqplib dan penanganan reconnect otomatis.
- **Rust Worker (`template-worker-rust`)**: Lapin AMQP dan RdKafka consumer async dengan Tokio.

---

## 🤖 Keunggulan: AI Agent Ready (`.agents`)

Berbeda dengan generator template tradisional, `@exa31/create-stack` dirancang dari awal untuk era **AI Coding Assistants**.

Setiap template membawa folder `.agents/skills/` dan aturan ketat di `AGENTS.md`. Ketika Anda membuat project fullstack multi-service, CLI secara cerdas **menggabungkan (merging)** seluruh rule dan skill arsitektur ke folder root `.agents/skills/`. AI assistant Anda langsung memahami konteks proyek secara utuh tanpa halusinasi arsitektur.
