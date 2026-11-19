---
title: Rust (Axum 0.7) Backend
description: Clean Architecture, SQLx compile-time query safety, Tracing JSON logger, SSE, WebSocket, Distributed Bridge, RabbitMQ, Kafka, dan Swagger di template-rust
---

Template `template-rust` adalah backend REST API berkinerja ultra-tinggi yang ditulis dalam **Rust** menggunakan framework asynchronous **Axum 0.7** dan **SQLx**, mematuhi prinsip Clean Architecture monorepo dengan jaminan keamanan memori dan konkurensi mutlak.

---

## ✨ Fitur Arsitektur Utama

- **Axum 0.7 & Tokio Async Runtime**: Web framework modern di atas ekosistem Tokio & Tower dengan throughput jutaan request/detik dan footprint memori minimal.
- **SQLx Compile-time Query Safety**: Query SQL divalidasi keamanannya langsung saat kompilasi kode (`cargo build`), mencegah kesalahan sintaks SQL dan tipe kolom sebelum runtime.
- **Pure Parameter-Passing Transactions**: Transaksi database wajib dioper secara eksplisit melalui `&mut Transaction<'_, Postgres>` tanpa penyimpanan tersembunyi di task-local.
- **Realtime Engine (SSE & WebSocket)**:
  - **Server-Sent Events (SSE)** via `axum::response::sse::Sse` dengan interval keep-alive 15 detik.
  - **WebSocket** via `axum::extract::ws::WebSocketUpgrade` dengan split sender/receiver task asynchronous.
- **Distributed Realtime Bridge (`REALTIME_BRIDGE`)**: Bridge multi-broker yang mendukung `local`, `redis`, `rabbitmq`, dan `both` (sinkronisasi ganda Redis + RabbitMQ).
- **Dual Message Brokers (RabbitMQ & Kafka)**:
  - RabbitMQ publisher terintegrasi berbasis library native async `lapin`.
  - Apache Kafka publisher terintegrasi berbasis async `rskafka`.
- **Argon2id & Token Theft Detection**: Password di-hash menggunakan Argon2id. Token refresh di-hash menggunakan SHA-256 di database dengan deteksi otomatis pencurian token.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` dengan output JSON terstruktur per baris (dilarang keras menggunakan `println!` atau `eprintln!`).
- **OpenAPI 3.0 Documentation**: Swagger UI terintegrasi di `http://localhost:8080/docs`.

---

## ⚡ Implementasi Transaksi Nyata (Pure Parameter Passing `&mut Transaction`)

Sesuai aturan monorepo (`database-transactions.md`), transaksi dioper murni via mutable borrow `&mut Transaction<'_, Postgres>` tanpa menyembunyikan transaksi di dalam task-local storage. Service layer mengorkestrasikan atomisitas multi-repository:

```rust title="src/modules/user/service.rs"
use sqlx::{PgPool, Transaction, Postgres};
use uuid::Uuid;
use crate::{
    modules::user::{
        dto::{CreateUserRequest, UpdateUserRequest, UserResponse},
        repository::{NewUser, UserRepository},
    },
    pkg::{auth::password::hash_password, errors::AppError},
};

pub struct UserService {
    pool: PgPool,
    repo: UserRepository,
}

impl UserService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            repo: UserRepository::new(),
        }
    }

    /// Registrasi user baru di dalam transaksi atomik
    pub async fn register(&self, req: CreateUserRequest) -> Result<UserResponse, AppError> {
        // 1. Memulai transaksi SQLx eksplisit
        let mut tx = self.pool.begin().await.map_err(|e| {
            AppError::internal(format!("Failed to start transaction: {}", e))
        })?;

        // 2. Oper &mut tx ke repository untuk validasi
        if self.repo.find_by_email_tx(&mut tx, &req.email).await?.is_some() {
            return Err(AppError::conflict("EMAIL_ALREADY_EXISTS", "Email is already registered"));
        }

        let password_hash = hash_password(&req.password).map_err(|e| {
            AppError::internal(format!("Failed to hash password: {}", e))
        })?;

        let new_user = NewUser {
            email: req.email,
            password_hash,
            name: req.name,
            role: "user".to_string(),
        };

        // 3. Oper &mut tx ke operasi insert data
        let user = self.repo.create_tx(&mut tx, new_user).await?;

        // 4. Commit transaksi jika seluruh tahapan sukses
        tx.commit().await.map_err(|e| {
            AppError::internal(format!("Failed to commit transaction: {}", e))
        })?;

        Ok(UserResponse::from(user))
    }
}
```

---

## 📡 Real-time Engine: SSE, WebSocket & RealtimeHub Auto-Bridge

`template-rust` menyajikan sistem realtime berkecepatan tinggi dengan Tokio broadcast channel dan bridge terdistribusi:

```mermaid
flowchart TD
    ClientSSE["SSE Client (EventSource)"] -->|GET /api/v1/realtime/sse| Axum1["Axum Pod 1"]
    ClientWS["WebSocket Client"] -->|ws:// /api/v1/realtime/ws| Axum2["Axum Pod 2"]
    
    Axum1 -->|RealtimeHub::broadcast| Bridge{"Realtime Bridge\n(REALTIME_BRIDGE)"}
    Bridge -->|Redis Pub/Sub\natau RabbitMQ Fanout| Axum1
    Bridge -->|Redis Pub/Sub\natau RabbitMQ Fanout| Axum2
    
    Axum1 -->|tokio::sync::broadcast| ClientSSE
    Axum2 -->|sender.send(Message::Text)| ClientWS
```

### 1. Server-Sent Events (SSE)
Handler SSE (`src/modules/realtime/sse.rs`) mengubah broadcast channel stream Tokio menjadi format SSE dengan interval keep-alive 15 detik:

```javascript title="Contoh Client SSE (Browser)"
const eventSource = new EventSource('http://localhost:8080/api/v1/realtime/sse');

eventSource.onmessage = (event) => {
  console.log('Realtime Event from Rust:', event.data);
};

eventSource.onerror = (err) => {
  console.error('SSE Error:', err);
  eventSource.close();
};
```

### 2. WebSocket Handler
Handler WebSocket (`src/modules/realtime/ws.rs`) memecah socket menjadi dua task independen (`send_task` dan `recv_task`) yang dijalankan paralel:

```javascript title="Contoh Client WebSocket (Browser / Node.js)"
const ws = new WebSocket('ws://localhost:8080/api/v1/realtime/ws');

ws.onopen = () => {
  console.log('Connected to Rust WebSocket server');
  ws.send(JSON.stringify({ type: 'GREETING', message: 'Hello from client' }));
};

ws.onmessage = (event) => {
  console.log('Incoming Message:', event.data);
};
```

### 3. Distributed Bridge (`REALTIME_BRIDGE=local|redis|rabbitmq|both`)
Sistem bridge mengimplementasikan trait `RealtimeBridge`:
- **`local`**: Hanya mem-broadcast event ke subscriber lokal instance ini.
- **`redis`**: Mem-publish dan me-listen event melalui Redis Pub/Sub (`realtime.events`).
- **`rabbitmq`**: Mem-publish ke exchange `realtime.events` tipe fanout dan me-listen dari antrean temporer unik.
- **`both`**: Melakukan sinkronisasi ganda ke Redis dan RabbitMQ secara simultan.

```rust title="src/pkg/realtime/hub.rs"
pub async fn broadcast(&self, message: impl Into<String>) {
    let msg = message.into();
    let _ = self.sender.send(msg.clone());

    if let Some(bridge) = self.bridge.read().await.as_ref() {
        let _ = bridge.publish("broadcast", &msg).await;
    }
}
```

---

## 🐰⚡ Dual Message Broker: RabbitMQ & Apache Kafka

Template Rust dilengkapi modul queue bawaan di `src/pkg/queue/`:

### 1. RabbitMQ Async Broker (`lapin`)
Dikelola oleh `RabbitMQBroker` (`src/pkg/queue/mod.rs`):

```rust
use crate::pkg::queue::RabbitMQBroker;

let broker = RabbitMQBroker::new(&amqp_url).await?;
broker.declare_queue("orders_queue", true).await?;
broker.publish("", "orders_queue", payload_bytes).await?;
```

### 2. Apache Kafka Async Broker (`rskafka`)
Dikelola oleh `KafkaBroker` (`src/pkg/queue/kafka.rs`):

```rust
use crate::pkg::queue::KafkaBroker;

let kafka = KafkaBroker::new(vec!["localhost:9092".to_string()]);
let offset = kafka.publish("app.events", Some(b"order-123".to_vec()), payload_bytes).await?;
```

---

## 🛡️ Idempotency Protection Layer (Axum Middleware & Store)

`template-rust` menyertakan middleware idempotency asinkron berkecepatan tinggi di `src/pkg/idempotency/mod.rs` yang mencegat operasi mutasi HTTP (`POST`, `PUT`, `PATCH`) untuk mencegah mutasi ganda:

```rust title="src/main.rs"
use axum::{middleware, routing::post, Router};
use std::sync::Arc;
use template_rust::pkg::idempotency::{idempotency_layer, IdempotencyStore};

// Inisialisasi IdempotencyStore (lifetime 24 jam, lock timeout 30 detik)
let idempotency_store = Arc::new(IdempotencyStore::default());

let app = Router::new()
    .route("/api/orders", post(create_order_handler))
    .layer(middleware::from_fn(move |req, next| {
        idempotency_layer(idempotency_store.clone(), req, next)
    }));
```

### Mekanisme Kerja Idempotency di Rust Axum:
1. **Header Evaluator**: Mengekstrak header `idempotency-key` atau `x-idempotency-key`.
2. **Atomic Lock (`try_lock`)**: Menyimpan status `InProgress` dengan timeout 30 detik. Jika request kedua tiba saat request pertama masih berjalan, server langsung mengembalikan HTTP `409 Conflict` dengan kode semantik `CODE_IDEMPOTENCY_IN_FLIGHT`.
3. **Response Buffer & Cache**: Mengubah body stream Axum menjadi `Bytes` yang aman di-cache ke dalam `IdempotencyStore` lengkap beserta seluruh response headers.
4. **Zero-Overhead Replay**: Jika request dengan key sama tiba setelah operasi selesai, server langsung membalas dari cache memori tanpa menyentuh database, dengan header `idempotent-replayed: true`.
5. **Auto Eviction**: Kunci yang kadaluarsa (> 24 jam) otomatis dihapus dari store memori saat diakses.

---

## ⚙️ Variabel Lingkungan (`.env`)

```ini title=".env"
# Server Configuration
HOST=0.0.0.0
PORT=8080
ENVIRONMENT=development
RUST_LOG=info

# Database (PostgreSQL)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/template_rust_db
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=5

# JWT Secrets
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-long
JWT_ACCESS_EXPIRATION_SECS=900
JWT_REFRESH_EXPIRATION_SECS=604800

# Realtime & Distributed Bridge
REALTIME_BRIDGE=redis  # Opsi: local | redis | rabbitmq | both

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672/%2f

# Apache Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=app.events
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-rust

# Compile dan verifikasi query SQLx
cargo check

# Jalankan migrasi database
sqlx migrate run

# Jalankan server dalam mode development
cargo run

# Jalankan test suite
cargo test

# Build biner release teroptimasi
cargo build --release
```
