---
title: Rust (Axum 0.7) Backend
description: Clean Architecture, SQLx compile-time query safety, Tracing JSON logger, SSE, WebSocket, Distributed Bridge, RabbitMQ, Kafka, and Swagger in template-rust
---

The `template-rust` template is an ultra-high performance REST API backend written in **Rust** using the asynchronous **Axum 0.7** framework and **SQLx**, strictly adhering to monorepo Clean Architecture guidelines with uncompromising memory safety and concurrency guarantees.

---

## ✨ Core Architectural Features

- **Axum 0.7 & Tokio Async Runtime**: Modern web framework on the Tokio & Tower ecosystem delivering millions of requests per second with negligible memory footprints.
- **SQLx Compile-time Query Safety**: SQL queries are validated against the database schema during compilation (`cargo build`), preventing syntax errors and type mismatches before deployment.
- **Pure Parameter-Passing Transactions**: Database transactions must be passed explicitly via `&mut Transaction<'_, Postgres>` without hidden task-local contexts.
- **Realtime Engine (SSE & WebSocket)**:
  - **Server-Sent Events (SSE)** via `axum::response::sse::Sse` with a 15-second keep-alive interval.
  - **WebSocket** via `axum::extract::ws::WebSocketUpgrade` with split asynchronous sender/receiver tasks.
- **Distributed Realtime Bridge (`REALTIME_BRIDGE`)**: Multi-broker bridge supporting `local`, `redis`, `rabbitmq`, and `both` (simultaneous dual-synchronization across Redis and RabbitMQ).
- **Dual Message Brokers (RabbitMQ & Kafka)**:
  - Asynchronous RabbitMQ broker based on the native `lapin` crate.
  - Asynchronous Apache Kafka broker based on `rskafka`.
- **Argon2id & Token Theft Detection**: Passwords hashed with Argon2id. Refresh tokens hashed with SHA-256 in the database with automated session invalidation on token reuse detection.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` generating structured JSON logs per line (raw `println!` and `eprintln!` are forbidden).
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI at `http://localhost:8080/docs`.

---

## ⚡ Database Transactions (Pure Parameter Passing)

Per monorepo rules (`database-transactions.md`), transactions are passed via mutable borrow `&mut Transaction<'_, Postgres>`. The service layer orchestrates atomicity across repositories:

### 1. Read-Only Operations

For data queries, SQLx pool references execute directly without transaction overhead:

```rust title="src/modules/user/service.rs"
pub async fn get_user_by_id(&self, id: Uuid) -> Result<UserResponse, AppError> {
    let user = self.repo.find_by_id(&self.pool, id).await?
        .ok_or_else(|| AppError::not_found("USER_NOT_FOUND", "User not found"))?;
    Ok(UserResponse::from(user))
}
```

### 2. Data Mutations & Atomic Rollback

For multi-table mutations, transactions begin via `self.pool.begin().await?` and `&mut tx` is passed explicitly:

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
        // 1. Begin explicit SQLx transaction
        let mut tx = self.pool.begin().await.map_err(|e| {
            AppError::internal(format!("Failed to start transaction: {}", e))
        })?;

        // 2. Pass &mut tx to repository for existence check
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

        // 3. Pass &mut tx to repository write operation
        let user = self.repo.create_tx(&mut tx, new_user).await?;

        // 4. Commit transaction when all stages succeed
        tx.commit().await.map_err(|e| {
            AppError::internal(format!("Failed to commit transaction: {}", e))
        })?;

        Ok(UserResponse::from(user))
    }
}
```

### 3. Repository Layer

At the repository layer, queries execute directly on `&mut Transaction<'_, Postgres>`:

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

`template-rust` delivers an ultra-fast realtime system utilizing Tokio broadcast channels and distributed bridging:

```mermaid
flowchart TD
    ClientSSE["SSE Client (EventSource)"] -->|GET /api/v1/realtime/sse| Axum1["Axum Pod 1"]
    ClientWS["WebSocket Client"] -->|ws:// /api/v1/realtime/ws| Axum2["Axum Pod 2"]
    
    Axum1 -->|RealtimeHub::broadcast| Bridge{"Realtime Bridge\n(REALTIME_BRIDGE)"}
    Bridge -->|Redis Pub/Sub\nor RabbitMQ Fanout| Axum1
    Bridge -->|Redis Pub/Sub\nor RabbitMQ Fanout| Axum2
    
    Axum1 -->|tokio::sync::broadcast| ClientSSE
    Axum2 -->|sender.send(Message::Text)| ClientWS
```

### 1. Server-Sent Events (SSE)
The SSE handler (`src/modules/realtime/sse.rs`) adapts the Tokio broadcast stream into an SSE stream with a 15-second keep-alive:

```javascript title="Client SSE Example (Browser)"
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
The WebSocket handler (`src/modules/realtime/ws.rs`) splits the socket into two decoupled asynchronous tasks (`send_task` and `recv_task`):

```javascript title="Client WebSocket Example (Browser / Node.js)"
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
The bridge system implements the `RealtimeBridge` trait:
- **`local`**: Broadcasts events strictly to local subscribers on this node.
- **`redis`**: Publishes and subscribes via Redis Pub/Sub (`realtime.events`).
- **`rabbitmq`**: Publishes to fanout exchange `realtime.events` and listens on an auto-delete temporary queue.
- **`both`**: Simultaneously synchronizes messages across Redis and RabbitMQ.

```rust title="src/pkg/realtime/hub.rs"
pub async fn broadcast(&self, message: impl Into<String>) {
    let msg = message.into();
    let _ = self.sender.send(msg.clone());

    if let Some(bridge) = self.bridge.read().await.as_ref() {
        let _ = bridge.publish("broadcast", &msg).await;
    }
}
```

### 4. Realtime API Endpoints

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| `GET` | `/api/v1/realtime/sse` | Opens SSE stream with 15-second keep-alive | Public |
| `WS` | `/api/v1/realtime/ws` | Full-duplex WebSocket connection | Public |
| `POST` | `/api/v1/realtime/broadcast` | Broadcast realtime event across all subscribers | Required (Bearer) |

---

## 🐰⚡ Dual Message Brokers: RabbitMQ & Apache Kafka

The Rust backend includes ready-to-use queue modules in `src/pkg/queue/`:

### 1. RabbitMQ Producer & Consumer
Managed by `RabbitMQBroker` (`src/pkg/queue/mod.rs`):

```rust title="src/pkg/queue/mod.rs"
use crate::pkg::queue::RabbitMQBroker;

let broker = RabbitMQBroker::new(&amqp_url).await?;
broker.declare_queue("orders_queue", true).await?;
broker.publish("", "orders_queue", payload_bytes).await?;
```

### 2. Apache Kafka Producer
Managed by `KafkaBroker` (`src/pkg/queue/kafka.rs`):

```rust title="src/pkg/queue/kafka.rs"
use crate::pkg::queue::KafkaBroker;

let kafka = KafkaBroker::new(vec!["localhost:9092".to_string()]);
let offset = kafka.publish("app.events", Some(b"order-123".to_vec()), payload_bytes).await?;
```

### 3. Broker Endpoints & Testing cURL

```bash title="Test Publish Event via cURL"
curl -X POST http://localhost:8080/api/v1/realtime/broadcast \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello cluster"}'
```

---

## 🛡️ Idempotency Protection (X-Idempotency-Key)

`template-rust` includes an asynchronous idempotency middleware in `src/pkg/idempotency/mod.rs` intercepting mutating HTTP requests (`POST`, `PUT`, `PATCH`) to guard against duplicate operations:

### 1. Middleware & Storage Configuration

```rust title="src/main.rs"
use axum::{middleware, routing::post, Router};
use std::sync::Arc;
use template_rust::pkg::idempotency::{idempotency_layer, IdempotencyStore};

// Initialize IdempotencyStore (24-hour lifetime, 30-second lock timeout)
let idempotency_store = Arc::new(IdempotencyStore::default());

let app = Router::new()
    .route("/api/orders", post(create_order_handler))
    .layer(middleware::from_fn(move |req, next| {
        idempotency_layer(idempotency_store.clone(), req, next)
    }));
```

### 2. Lock, Fingerprint & Replay Mechanics
1. **Header Evaluator**: Extracts `idempotency-key` or `x-idempotency-key`.
2. **Atomic Lock (`try_lock`)**: Marks state as `InProgress` with a 30-second timeout. Concurrent requests arriving simultaneously are rejected with HTTP `409 Conflict` and semantic code `CODE_IDEMPOTENCY_IN_FLIGHT`.
3. **Response Buffer & Cache**: Converts Axum's response stream into cached `Bytes` stored inside `IdempotencyStore` alongside original headers.
4. **Zero-Overhead Replay**: Subsequent requests with the same key replay directly from in-memory cache without hitting database connections, returning `idempotent-replayed: true`.
5. **Auto Eviction**: Expired keys (> 24 hours) are cleanly evicted from store memory upon access.

---

## 🚦 Dual-Tier Rate Limiting & DoS Protection

`template-rust` provides a Tokio async `RateLimiter` module in `src/pkg/ratelimit/`:

### 1. Protection Tiers: Global API vs Strict Auth

1. **Global Rate Limiter**:
   - Caps general API calls at `RATE_LIMIT_MAX` (default: 100 req / 60 seconds per IP).
   - Mounted on the Axum router in `src/lib.rs`: `.layer(middleware::from_fn_with_state(global_limiter, global_rate_limit_middleware))`.
   - Whitelists health probes (`/health`, `/`) and documentation (`/docs`, `/swagger-ui`).
2. **Strict Auth Limiter**:
   - Protects authentication routes (`/api/v1/auth/login`, `/api/v1/auth/register`) against brute force.
   - Enforces strict quota `RATE_LIMIT_AUTH_MAX` (default: 5 req / 60 seconds).
   - Composite key generator: `ip + ":" + path`.

### 2. RFC 6585 Standard Headers & Hybrid Storage

- **RFC 6585 Headers**: Emits `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` (on HTTP 429).
- **Response Format**: Returns HTTP `429 Too Many Requests` envelope `BaseResponse::error("Too many requests...", CODE_RATE_LIMIT_EXCEEDED)`.
- **In-Memory Concurrency**: Thread-safe `Arc<Mutex<HashMap<String, (u64, Instant)>>>` with automatic periodic eviction for high performance without external overhead.

---

## 🧵 Request Context, Tracing & Correlation ID

`template-rust` delivers high-performance asynchronous request context propagation built on the standard `tower-http` and `tracing` crates.

### 1. X-Request-ID & Context Propagation

- **ID Extraction & Generation**: The `create_request_id_layer()` layer (`src/pkg/logging/middleware.rs`, leveraging `tower_http::request_id::SetRequestIdLayer` and `MakeRequestUuid`) inspects incoming `x-request-id` headers or generates a fresh UUID v4.
- **Automatic Response Propagation**: The `create_propagate_request_id_layer()` (`PropagateRequestIdLayer`) automatically echoes the `x-request-id` header onto all outgoing HTTP responses.
- **Request Extensions & Tokio Task Propagation**: The correlation ID is stored within Axum request extensions. Across Tokio async tasks and worker threads, context is preserved via `tracing::Instrument`.

### 2. Structured Logging & OpenTelemetry Integration

- **HTTP Tracing Spans**: `create_trace_layer` (`TraceLayer::new_for_http()`) encloses each incoming HTTP request in an `INFO`-level tracing span, recording request lifecycles and response latency without unnecessary heap allocations.
- **OpenTelemetry Tracer Provider**: `src/pkg/telemetry/mod.rs` configures W3C `TraceContextPropagator` and an OTLP Span Exporter over Tonic gRPC (`opentelemetry-otlp`). When `OTEL_ENABLED=true`, spans are batched and exported asynchronously to OpenTelemetry Collectors.
- **Structured JSON Subscriber**: Emits structured NDJSON log records via `tracing-subscriber` with `json` formatting, ensuring all internal application logs, SQLx queries, and access logs carry structured span metadata.

---

## 📦 Unified Object Storage (MinIO, S3, Local)

`template-rust` implements a zero-overhead asynchronous object storage driver in `src/pkg/storage/` via the `Storage` trait.

### 1. Unified Drivers & Pre-Signed URLs

- **Async `Storage` Trait**: `async_trait` abstraction backing `LocalStorage` and `S3Storage` (supporting MinIO, AWS S3, and Cloudflare R2 via AWS Signature v4).
- **Pre-Signed Upload & Download URLs**: Cryptographically signs time-limited upload and download URLs via `get_presigned_upload_url()` and `get_presigned_download_url()`.
- **Path Traversal Shield**: `LocalStorage` verifies canonical paths (`canonicalize()`) against the designated base directory to block relative path exploits (`../`).

### 2. Upload Endpoints & Testcontainers Integration

- **Upload Module Routes (`src/modules/uploads.rs`)**:
  - `POST /api/v1/uploads`: Parses Axum multipart streams via `futures_util::StreamExt` directly into the storage engine.
  - `GET /api/v1/uploads/*key`: Streams file content with automatic MIME sniffing.
  - `DELETE /api/v1/uploads/*key`: Idempotently deletes files from bucket or disk.
  - `POST /api/v1/uploads/presigned-url`: Issues presigned upload URLs.
- **Testcontainers Integration**: `tests/storage_test.rs` verifies complete storage lifecycles against live MinIO Testcontainers instances in Docker.

---

## 📋 Request Validation & Boundaries

Validates incoming DTO structures using `ValidatedJson<T>` on top of `validator`:

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

In controller handlers:
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

## ⚙️ Environment Variables & Configuration

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
REALTIME_BRIDGE=redis  # Options: local | redis | rabbitmq | both

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672/%2f

# Apache Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=app.events
```

---

## 🛠️ Development Commands

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
