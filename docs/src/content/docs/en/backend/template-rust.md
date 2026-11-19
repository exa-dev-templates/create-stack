---
title: Rust (Axum 0.7) Backend
description: Clean Architecture, SQLx compile-time query safety, Tracing JSON logger, and Argon2id in template-rust
---

The `template-rust` starter kit is an ultra-high performance REST API backend written in **Rust** using the asynchronous **Axum 0.7** framework and **SQLx**, strictly adhering to monorepo Clean Architecture with absolute memory and type safety guarantees.

---

## ✨ Key Features

- **Axum 0.7 & Tokio**: Modern asynchronous web stack on Tokio & Tower with extreme throughput and negligible memory footprint.
- **SQLx Compile-time Query Safety**: SQL queries are validated directly at compile time (`cargo build`), preventing SQL syntax and schema mismatches prior to runtime.
- **Pure Parameter-Passing Transactions**: Database transactions must be passed explicitly via `&mut Transaction<'_, Postgres>` or `&mut Transaction<'_, MySql>`.
- **Argon2id & Token Theft Detection**: Password hashing with Argon2id. Refresh tokens are hashed using SHA-256 with automatic token reuse & theft detection that revokes all active sessions upon compromise.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` streaming structured JSON per line (zero raw `println!` or `eprintln!`).
- **Distributed Realtime Bridge**: WebSocket & SSE events distributed across container replicas via Redis Pub/Sub or RabbitMQ Fanout with graceful in-memory fallback.
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI served at `http://localhost:8080/docs`.

---

## ⚡ Transaction Implementation Pattern (Pure Parameter Passing)

Per monorepo standard (`database-transactions.md`), transactions are passed via mutable references:

```rust title="src/services/user_service.rs"
pub async fn register_user(
    &self,
    dto: RegisterUserDto,
) -> Result<UserResponse, AppError> {
    // 1. Begin database transaction
    let mut tx = self.db_pool.begin().await.map_err(AppError::from)?;

    // 2. Explicitly pass transaction to repository
    let existing = self.user_repo.find_by_email(&mut tx, &dto.email).await?;
    if existing.is_some() {
        return Err(AppError::conflict(
            constants::CODE_EMAIL_ALREADY_EXISTS,
            "Email already registered",
        ));
    }

    let user = self.user_repo.create(&mut tx, &dto).await?;

    // 3. Commit transaction on success
    tx.commit().await.map_err(AppError::from)?;

    Ok(user.into())
}
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd backend

# Start development server (port 8080)
cargo run

# Run SQLx database migrations
cargo sqlx migrate run

# Run quality gates (fmt, clippy, unit tests)
make check
```
