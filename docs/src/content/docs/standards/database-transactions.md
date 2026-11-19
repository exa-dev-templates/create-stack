---
title: Standar Transaksi Database (Pure Parameter Passing)
description: Aturan keselamatan transaksi ACID dan larangan context-hidden transactions
---

Operasi mutasi data pada database (INSERT, UPDATE, DELETE) yang melibatkan lebih dari satu tabel atau langkah bisnis **WAJIB** dieksekusi dalam transaksi ACID.

---

## 🚫 Larangan Keras: Context-Hidden Transactions

- **Pada Go**: Dilarang menyimpan atau mengambil pointer transaksi (`*sqlx.Tx`) ke dalam/dari `context.Context`. Pola "magic context" ini membuat alur eksekusi sulit diuji dan rentan terjadi *connection leak*.
- **Pada Rust**: Dilarang menyembunyikan objek `sqlx::Transaction` di dalam thread-local atau task-local storage.

---

## ✅ Wajib: Pure Parameter Passing

Pointer atau reference transaksi wajib dioper secara terbuka (*pure parameter passing*) dari layer Service ke layer Repository:

### Go:
```go
// Handler memanggil Service
// Service membuka tx dan mengoper ke Repository:
func (r *UserRepository) Create(ctx context.Context, tx *sqlx.Tx, user *User) error {
    query := `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)`
    _, err := tx.ExecContext(ctx, query, user.ID, user.Name, user.Email)
    return err
}
```

### Rust:
```rust
pub async fn create(
    &self,
    tx: &mut Transaction<'_, Postgres>,
    user: &User,
) -> Result<(), AppError> {
    sqlx::query("INSERT INTO users (id, name, email) VALUES ($1, $2, $3)")
        .bind(&user.id)
        .bind(&user.name)
        .bind(&user.email)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
```

### Java:
- Operasi mutasi wajib dianotasikan `@Transactional`.
- Operasi pembacaan (queries) wajib dianotasikan `@Transactional(readOnly = true)` untuk optimasi dirty-checking Hibernate.
