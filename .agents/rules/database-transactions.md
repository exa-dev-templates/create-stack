---
description: Mandatory pure parameter passing for database transactions, prohibiting context-based transaction resolution
globs: ["**/*.go"]
---

# Database Transactions: Pure Parameter Passing Rules

When writing database and repository operations in Go, all agents and developers must strictly adhere to **explicit parameter passing** for transactions.

---

## 1. Strictly Prohibited: Context-Based Transactions

- ❌ **DILARANG KERAS** menyimpan atau mengambil transaksi dari `context.Context`:
  - Dilarang menggunakan `context.WithValue` dengan key transaksi.
  - Dilarang membuat fungsi resolver seperti `TxFromContext(ctx)`, `database.GetExecutor(ctx, db)`, `r.getExecutor(ctx)`, atau fungsi sejenis.
  - Dilarang menggunakan middleware HTTP/Fiber yang otomatis membuka transaksi dan menaruhnya ke dalam context.
- **Alasan**:
  - Menyalahi pedoman resmi Go (`context.Context` adalah untuk request-scoped metadata dan cancellation/deadline).
  - Menyembunyikan dependensi (hidden side-effects) dan menghilangkan *compile-time safety*.
  - Rawan silent bug jika context tidak memiliki transaksi dan diam-diam fallback ke koneksi non-transaksional.

---

## 2. Mandatory: Pure Parameter Passing (`tx *sqlx.Tx`)

- ✅ **Wajib Oper Transaksi Sebagai Parameter Eksplisit**:
  - Semua method repository yang berinteraksi dengan database **WAJIB** menerima pointer transaksi secara langsung pada signature fungsi:
    ```go
    Create(ctx context.Context, tx *sqlx.Tx, req CreateRequest) (*EntityResponse, error)
    FindByID(ctx context.Context, tx *sqlx.Tx, id int64) (*EntityResponse, error)
    ```
  - Repository memvalidasi keberadaan transaksi di awal method:
    ```go
    if tx == nil {
        return nil, errors.New("transaction is required")
    }
    ```
  - Semua query database (`QueryRowxContext`, `SelectContext`, `GetContext`, `ExecContext`) dijalankan langsung pada objek `tx`.

---

## 3. Transaction Boundary di Layer Service / UseCase

- Service bertindak sebagai orchestrator alur bisnis yang membuka batas transaksi menggunakan helper terpusat:
  - **Operasi Mutasi (`INSERT`, `UPDATE`, `DELETE`)**:
    ```go
    err := s.db.WithTransactionCtx(ctx, func(tx *sqlx.Tx) error {
        res, err = s.repo.Create(ctx, tx, req)
        if err != nil {
            return err
        }
        return s.activityRepo.Create(ctx, tx, ...)
    })
    ```
  - **Operasi Baca (`SELECT`)**:
    ```go
    err := s.db.WithReadOnlyTransactionCtx(ctx, func(tx *sqlx.Tx) error {
        res, err = s.repo.FindByID(ctx, tx, id)
        return err
    })
    ```
- Jika satu alur membutuhkan operasi read-then-write atau atomic cascading across multiple repositories, seluruh method repository dipanggil dengan instance `tx` yang sama di dalam block `WithTransactionCtx`.
