---
title: Rust (Axum 0.7) Backend
description: Clean Architecture, SQLx compile-time query safety, Tracing JSON logger, dan Argon2id di template-rust
---

Template `template-rust` adalah backend REST API berkinerja ultra-tinggi yang ditulis dalam **Rust** menggunakan framework asynchronous **Axum 0.7** dan **SQLx**, mematuhi prinsip Clean Architecture monorepo dengan keamanan tipe dan memori mutlak.

---

## ✨ Fitur Utama

- **Axum 0.7 & Tokio**: Web framework modern di atas ekosistem Tokio & Tower dengan throughput ekstrem dan footprint memori minimal.
- **SQLx Compile-time Query Safety**: Query SQL divalidasi keamanannya langsung saat kompilasi kode (`cargo build`), mencegah kesalahan sintaks SQL sebelum runtime.
- **Pure Parameter-Passing Transactions**: Transaksi database wajib dioper secara eksplisit melalui `&mut Transaction<'_, Postgres>` atau `&mut Transaction<'_, MySql>`.
- **Argon2id & Token Theft Detection**: Password di-hash menggunakan Argon2id. Token refresh di-hash menggunakan SHA-256 di database dengan deteksi pemakaian ulang token (*token theft detection*) yang otomatis mencabut seluruh sesi jika terjadi anomali.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` dengan output JSON terstruktur per baris (dilarang keras menggunakan `println!` atau `eprintln!`).
- **Distributed Realtime Bridge**: Bridge WebSocket & SSE terdistribusi via Redis Pub/Sub atau RabbitMQ Fanout Exchange dengan fallback in-memory yang elegan.
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

impl UserService {
    /// Update user dan cabut sesi aktif secara atomik jika user dinonaktifkan
    pub async fn update_user(
        &self,
        id: Uuid,
        req: UpdateUserRequest,
    ) -> Result<UserResponse, AppError> {
        // 1. Mulai transaksi database dari pool
        let mut tx = self.pool.begin().await.map_err(AppError::Database)?;

        // 2. Oper &mut tx secara eksplisit ke repository user
        let updated_user = self.repo.update(&mut tx, id, &req).await?;

        // 3. Cascading multi-repository: cabut seluruh token sesi jika akun dinonaktifkan
        if let Some(false) = req.is_active {
            self.auth_repo.revoke_all_user_tokens(&mut tx, id).await?;
        }

        // 4. Commit transaksi jika semua operasi sukses
        tx.commit().await.map_err(AppError::Database)?;

        Ok(updated_user)
    }
}
```

Trait repository mewajibkan passing `&mut Transaction`:

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

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd backend

# Jalankan server development (port 8080)
cargo run

# Jalankan migrasi SQLx
cargo sqlx migrate run

# Jalankan quality gates (fmt-check, clippy linter, unit tests)
make check
```
