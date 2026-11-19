---
title: Golang (Fiber v2) Backend
description: Clean Architecture, pure parameter passing tx, sqlx, structured slog, dan Swagger di template-golang
---

Template `template-golang` adalah backend REST API berkinerja tinggi yang ditulis dalam **Go 1.22+** dan framework **Fiber v2** (Express.js-like API), menerapkan Clean Architecture yang ketat dan keamanan transaksi database tanpa magic context.

---

## ✨ Fitur Utama

- **Fiber v2 Framework**: Router berbasis Fasthttp dengan alokasi memori mendekati nol (*zero memory allocation*).
- **Pure Parameter-Passing Transactions**: Transaksi database wajib dioper secara eksplisit melalui `tx *sqlx.Tx`. Dilarang menyembunyikan transaksi di dalam `context.Context`.
- **sqlx Raw Queries**: Menulis SQL native yang teroptimasi tanpa kebingungan abstraction layer ORM.
- **Structured slog Logger**: Modul `pkg/logging` terpusat yang menghasilkan output log JSON berkecepatan tinggi (dilarang keras menggunakan `fmt.Println` atau `log.Println`).
- **Database Migrations**: Menggunakan `golang-migrate/migrate` untuk migrasi SQL versi terkelola.
- **Centralized Error Parsing**: Penanganan otomatis error PostgreSQL/MySQL (seperti unique violation, foreign key failure) menjadi kode semantik yang ramah API.
- **Interactive Swagger**: Dokumentasi Swagger terintegrasi di `http://localhost:8080/docs`.

---

## ⚡ Contoh Implementasi Transaction (Pure Parameter Passing)

Sesuai aturan monorepo (`database-transactions.md`), transaksi wajib di-pass sebagai parameter murni:

```go title="internal/service/user_service.go"
func (s *UserService) Register(ctx context.Context, req *dto.RegisterRequest) (*dto.UserResponse, error) {
    // 1. Mulai transaksi sqlx
    tx, err := s.db.BeginTxx(ctx, nil)
    if err != nil {
        return nil, err
    }
    defer tx.Rollback() // Otomatis rollback jika terjadi error/panic

    // 2. Oper tx ke repository
    existing, err := s.userRepo.FindByEmail(ctx, tx, req.Email)
    if err == nil && existing != nil {
        return nil, errors.NewAppError(constants.CodeEmailAlreadyExists, "Email is already taken", 409)
    }

    user := &entity.User{
        Email:    req.Email,
        Password: hashedPassword,
    }
    if err := s.userRepo.Create(ctx, tx, user); err != nil {
        return nil, err
    }

    // 3. Commit transaksi jika sukses
    if err := tx.Commit(); err != nil {
        return nil, err
    }

    return dto.ToUserResponse(user), nil
}
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd backend

# Download module dependencies
go mod download

# Jalankan migrasi database
make migrate-up

# Jalankan server development (port 8080)
make dev
# atau: go run cmd/api/main.go

# Jalankan test suite
make test
```
