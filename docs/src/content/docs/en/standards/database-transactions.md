---
title: Database Transactions (Pure Parameter Passing)
description: ACID transactional safety and prohibition of context-hidden transaction objects
---

Data mutation operations (INSERT, UPDATE, DELETE) spanning multiple tables or critical business steps **MUST** execute within an explicit ACID transaction.

---

## 🚫 Strict Prohibition: Context-Hidden Transactions

- **In Go**: Storing or extracting transaction pointers (`*sqlx.Tx`) into/from `context.Context` is strictly forbidden. This anti-pattern obscures dependencies and leads to silent connection leaks.
- **In Rust**: Storing `sqlx::Transaction` inside task-local or thread-local contexts is strictly forbidden.

---

## ✅ Mandatory: Pure Parameter Passing

Transaction handles must be passed explicitly as typed function arguments from Service to Repository:

### Go:
```go
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
- Mutation operations must carry `@Transactional`.
- Read operations must carry `@Transactional(readOnly = true)` to disable Hibernate dirty checking overhead.
