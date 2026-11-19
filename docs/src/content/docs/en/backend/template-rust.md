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

## ⚡ Real-World Transaction Pattern (Pure Parameter Passing `&mut Transaction`)

Per monorepo standard (`database-transactions.md`), transactions are passed purely via mutable borrow `&mut Transaction<'_, Postgres>` without hiding transactions inside task-local storage. The service layer orchestrates multi-repository atomic operations:

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

impl UserService {
    /// Updates a user profile and revokes sessions atomically if deactivated
    pub async fn update_user(
        &self,
        id: Uuid,
        req: UpdateUserRequest,
    ) -> Result<UserResponse, AppError> {
        // 1. Begin database transaction on the pool
        let mut tx = self.pool.begin().await.map_err(AppError::Database)?;

        // 2. Explicitly forward &mut tx to user repository
        let updated_user = self.repo.update(&mut tx, id, &req).await?;

        // 3. Multi-repository cascading: revoke active session tokens upon deactivation
        if let Some(false) = req.is_active {
            self.auth_repo.revoke_all_user_tokens(&mut tx, id).await?;
        }

        // 4. Commit transaction upon success
        tx.commit().await.map_err(AppError::Database)?;

        Ok(updated_user)
    }
}
```

Repository traits enforce passing `&mut Transaction`:

```rust title="src/modules/user/repository.rs"
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        new_user: NewUser<'_>,
    ) -> Result<UserResponse, AppError>;

    async fn update(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: Uuid,
        req: &UpdateUserRequest,
    ) -> Result<UserResponse, AppError>;
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
