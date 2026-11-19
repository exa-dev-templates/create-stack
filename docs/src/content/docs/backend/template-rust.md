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

## ⚡ Contoh Implementasi Transaction (Pure Parameter Passing)

Sesuai aturan monorepo (`database-transactions.md`), transaksi dioper murni via mutable reference:

```rust title="src/services/user_service.rs"
pub async fn register_user(
    &self,
    dto: RegisterUserDto,
) -> Result<UserResponse, AppError> {
    // 1. Mulai transaksi database
    let mut tx = self.db_pool.begin().await.map_err(AppError::from)?;

    // 2. Oper transaksi secara eksplisit ke repository
    let existing = self.user_repo.find_by_email(&mut tx, &dto.email).await?;
    if existing.is_some() {
        return Err(AppError::conflict(
            constants::CODE_EMAIL_ALREADY_EXISTS,
            "Email already registered",
        ));
    }

    let user = self.user_repo.create(&mut tx, &dto).await?;

    // 3. Commit transaksi jika sukses
    tx.commit().await.map_err(AppError::from)?;

    Ok(user.into())
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
