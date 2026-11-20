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

## ⚡ Transaksi Database (Pure Parameter Passing)

Sesuai aturan monorepo (`database-transactions.md`), transaksi dioper murni via mutable borrow `&mut Transaction<'_, Postgres>` tanpa menyembunyikan transaksi di dalam task-local storage. Service layer mengorkestrasikan atomisitas multi-repository:

### 1. Operasi Pembacaan / Read-Only

Untuk operasi pembacaan, koneksi pool SQLx dieksekusi langsung tanpa overhead transaksi mutasi:

```rust title="src/modules/user/service.rs"
pub async fn get_user_by_id(&self, id: Uuid) -> Result<UserResponse, AppError> {
    let user = self.repo.find_by_id(&self.pool, id).await?
        .ok_or_else(|| AppError::not_found("USER_NOT_FOUND", "User not found"))?;
    Ok(UserResponse::from(user))
}
```

### 2. Operasi Mutasi Data & Atomic Rollback

Untuk registrasi atau mutasi multi-tabel, transaksi dimulai via `self.pool.begin().await?` dan `&mut tx` dioper secara eksplisit:

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

### 3. Layer Repository

Di layer repository, query dieksekusi langsung pada `&mut Transaction<'_, Postgres>`:

```rust title="src/modules/user/repository.rs"
pub async fn create_tx(
    &self,
    tx: &mut Transaction<'_, Postgres>,
    new_user: NewUser,
) -> Result<User, AppError> {
    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (email, password_hash, name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, password_hash, name, role, created_at, updated_at
        "#,
        new_user.email,
        new_user.password_hash,
        new_user.name,
        new_user.role
    )
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::internal(format!("Database insert failed: {}", e)))?;

    Ok(user)
}
```

---

## 📡 Real-time Engine: SSE, WebSocket & Distributed Bridge

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

### 2. Full-Duplex WebSocket
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

### 3. Distributed Auto-Bridge (Horizontal Scaling)
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

### 4. Daftar Endpoint Realtime

| Method | Endpoint | Deskripsi | Autentikasi |
|---|---|---|---|
| `GET` | `/api/v1/realtime/sse` | Membuka stream SSE dengan keep-alive 15 detik | Terbuka |
| `WS` | `/api/v1/realtime/ws` | Membuka koneksi WebSocket full-duplex | Terbuka |
| `POST` | `/api/v1/realtime/broadcast` | Mengirim event realtime ke seluruh subscriber | Wajib (Bearer) |

---

## 🐰⚡ Dual Message Broker: RabbitMQ & Apache Kafka

Template Rust dilengkapi modul queue bawaan di `src/pkg/queue/`:

### 1. RabbitMQ Producer & Consumer
Dikelola oleh `RabbitMQBroker` (`src/pkg/queue/mod.rs`) berbasis `lapin`:

```rust title="src/pkg/queue/mod.rs"
use crate::pkg::queue::RabbitMQBroker;

let broker = RabbitMQBroker::new(&amqp_url).await?;
broker.declare_queue("orders_queue", true).await?;
broker.publish("", "orders_queue", payload_bytes).await?;
```

### 2. Apache Kafka Producer
Dikelola oleh `KafkaBroker` (`src/pkg/queue/kafka.rs`) berbasis `rskafka`:

```rust title="src/pkg/queue/kafka.rs"
use crate::pkg::queue::KafkaBroker;

let kafka = KafkaBroker::new(vec!["localhost:9092".to_string()]);
let offset = kafka.publish("app.events", Some(b"order-123".to_vec()), payload_bytes).await?;
```

### 3. Daftar Endpoint & Testing cURL

```bash title="Testing Publish Event via cURL"
curl -X POST http://localhost:8080/api/v1/realtime/broadcast \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello cluster"}'
```

---

## 🛡️ Proteksi Idempotency (X-Idempotency-Key)

`template-rust` menyertakan middleware idempotency asinkron berkecepatan tinggi di `src/pkg/idempotency/mod.rs` yang mencegat operasi mutasi HTTP (`POST`, `PUT`, `PATCH`) untuk mencegah mutasi ganda:

### 1. Konfigurasi Middleware & Storage

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

### 2. Mekanisme Kunci, Fingerprint & Replay
1. **Header Evaluator**: Mengekstrak header `idempotency-key` atau `x-idempotency-key`.
2. **Atomic Lock (`try_lock`)**: Menyimpan status `InProgress` dengan timeout 30 detik. Jika request kedua tiba saat request pertama masih berjalan, server langsung mengembalikan HTTP `409 Conflict` dengan kode semantik `CODE_IDEMPOTENCY_IN_FLIGHT`.
3. **Response Buffer & Cache**: Mengubah body stream Axum menjadi `Bytes` yang aman di-cache ke dalam `IdempotencyStore` lengkap beserta seluruh response headers.
4. **Zero-Overhead Replay**: Jika request dengan key sama tiba setelah operasi selesai, server langsung membalas dari cache memori tanpa menyentuh database, dengan header `idempotent-replayed: true`.
5. **Auto Eviction**: Kunci yang kadaluarsa (> 24 jam) otomatis dihapus dari store memori saat diakses.

---

## 🚦 Dual-Tier Rate Limiting & Proteksi DoS

`template-rust` menyediakan modul `RateLimiter` berbasis Tokio async di `src/pkg/ratelimit/`:

### 1. Tingkatan Proteksi: Global API vs Strict Auth

1. **Global Rate Limiter**:
   - Membatasi request umum dengan kuota `RATE_LIMIT_MAX` (default: 100 req / 60 detik per IP).
   - Dipasang pada Axum router di `src/lib.rs`: `.layer(middleware::from_fn_with_state(global_limiter, global_rate_limit_middleware))`.
   - Mengabaikan (*whitelist*) route `/health`, `/`, `/docs`, dan `/swagger-ui`.
2. **Strict Auth Limiter**:
   - Membatasi route autentikasi (`/api/v1/auth/login`, `/api/v1/auth/register`) dari serangan *brute force*.
   - Kuota ketat `RATE_LIMIT_AUTH_MAX` (default: 5 req / 60 detik).
   - Key generator komposit: `ip + ":" + path`.

### 2. Header Standar RFC 6585 & Storage Hybrid

- **Header RFC 6585**: Menyertakan `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan `Retry-After` (saat HTTP 429).
- **Format Response**: Mengembalikan status `429 Too Many Requests` envelope `BaseResponse::error("Too many requests...", CODE_RATE_LIMIT_EXCEEDED)`.
- **In-Memory Concurrency**: Menggunakan `Arc<Mutex<HashMap<String, (u64, Instant)>>>` yang thread-safe dengan auto-eviction otomatis untuk performa tinggi tanpa overhead eksternal.

---

## 🧵 Request Context, Tracing & Correlation ID

`template-rust` menerapkan propagasi konteks asynchronous performa tinggi berbasis ekosistem `tower-http` dan `tracing` crate standard Rust.

### 1. Propagasi X-Request-ID & Lifecycle Context

- **Ekstraksi & Generasi ID**: Layer `create_request_id_layer()` (`src/pkg/logging/middleware.rs`, berbasis `tower_http::request_id::SetRequestIdLayer` dan `MakeRequestUuid`) membaca header `x-request-id` dari client atau meng-generate identifier UUID v4 unik.
- **Injeksi Response Otomatis**: Layer `create_propagate_request_id_layer()` (`PropagateRequestIdLayer`) otomatis menyalin header `x-request-id` dari request ke response header keluar, menjamin korelasi ID pada setiap client.
- **Request Extensions & Tokio Task Propagation**: Identifier request tersimpan di dalam Axum `Request` extensions. Di dalam ekosistem asynchronous Tokio, tracing span di-propagasikan melintasi thread boundary dan task spawned via instrumentasi `tracing::Instrument`.

### 2. Integrasi Structured Logging & OpenTelemetry

- **HTTP Tracing Span**: `create_trace_layer` (`TraceLayer::new_for_http()`) membungkus setiap request ke dalam tracing span `tracing::Level::INFO`, mencatat siklus hidup request dan latency respons tanpa alokasi string berlebih.
- **OpenTelemetry Tracer Provider**: Modul `src/pkg/telemetry/mod.rs` mengonfigurasi W3C `TraceContextPropagator` dan OTLP Span Exporter via Tonic gRPC (`opentelemetry-otlp`). Saat `OTEL_ENABLED=true`, trace spans diekspor ke OpenTelemetry Collector secara asynchronous via `BatchSpanProcessor`.
- **Structured JSON Subscriber**: Menggunakan `tracing-subscriber` dengan format JSON, sehingga seluruh event log internal, database query SQLx, dan access log menghasilkan satu baris NDJSON terstruktur dengan level, target, timestamp, dan context fields.

---

## 📦 Unified Object Storage (MinIO, S3, Local)

`template-rust` mengimplementasikan driver penyimpanan objek asynchronous zero-overhead di `src/pkg/storage/` dengan trait `Storage`.

### 1. Provider Terpadu & Pre-Signed URLs

- **Trait Asinkron `Storage`**: Abstraksi `async_trait` yang mengimplementasikan `LocalStorage` dan `S3Storage` (mendukung MinIO, AWS S3, Cloudflare R2 via signature v4).
- **Pre-Signed Upload & Download**: Method `get_presigned_upload_url()` dan `get_presigned_download_url()` menghasilkan link bertanda tangan kriptografis dengan jangka waktu kedaluwarsa.
- **Proteksi Path Traversal**: `LocalStorage` menerapkan `canonicalize()` pada path dasar dan memverifikasi batas prefix direktori untuk menolak manipulasi path (`../`).

### 2. Endpoint Upload & Integrasi Testcontainers

- **Module Endpoints (`src/modules/uploads.rs`)**:
  - `POST /api/v1/uploads`: Menerima multipart payload Axum dengan streaming byte `futures_util::StreamExt` ke storage driver.
  - `GET /api/v1/uploads/*key`: Streaming pembacaan file dengan MIME sniffing otomatis.
  - `DELETE /api/v1/uploads/*key`: Menghapus file secara idempoten.
  - `POST /api/v1/uploads/presigned-url`: Membuat URL upload presigned.
- **Suite Pengujian Testcontainers**: `tests/storage_test.rs` memvalidasi siklus operasi MinIO nyata menggunakan Testcontainers Rust dengan isolasi container Docker.

---

## 📋 Validasi Input Request & Boundaries

Validasi DTO menggunakan custom Axum extractor `ValidatedJson<T>` di atas crate `validator`:

```rust title="src/modules/user/dto.rs"
use serde::Deserialize;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 3, max = 50, message = "Name must be between 3 and 50 characters"))]
    pub name: String,

    #[validate(email(message = "Invalid email address"))]
    pub email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}
```

Di controller:
```rust
pub async fn register_user(
    State(service): State<Arc<UserService>>,
    ValidatedJson(req): ValidatedJson<CreateUserRequest>,
) -> Result<Json<BaseResponse<UserResponse>>, AppError> {
    let user = service.register(req).await?;
    Ok(Json(BaseResponse::success("User registered successfully", user)))
}
```

---

## ⚙️ Variabel Lingkungan & Konfigurasi

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

# Check compilation and verify SQLx queries
cargo check

# Run database migrations
sqlx migrate run

# Run local development server
cargo run

# Run test suite
cargo test

# Build optimized release binary
cargo build --release
```
