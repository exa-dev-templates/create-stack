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

## ⚡ Implementasi Transaksi Nyata (TransactionManager & Pure Parameter Passing)

Sesuai aturan monorepo (`database-transactions.md`), template ini tidak menggunakan "magic context" dan tidak memaksa developer menulis boilerplate `BeginTxx / defer tx.Rollback / Commit` secara manual di setiap service. Sebagai gantinya, modul `database.TransactionManager` (`s.tm`) mengelola lifecycle transaksi secara aman (termasuk panic recovery & context cancellation) sambil tetap mewajibkan **pure parameter passing (`tx *sqlx.Tx`)** ke repository.

### 1. Operasi Pembacaan / Read-Only (`GetAll`)
Pada query pembacaan data, service memanfaatkan `WithReadOnlyTransactionCtx`:

```go title="internal/module/user/service.go"
func (s *userService) GetAll(ctx context.Context) ([]UserResponse, error) {
	var users []User
	err := s.tm.WithReadOnlyTransactionCtx(ctx, func(tx *sqlx.Tx) error {
		var err error
		users, err = s.repo.GetAll(ctx, tx)
		return err
	})
	if err != nil {
		return nil, appErrors.DatabaseError("Failed to fetch users", err)
	}

	res := make([]UserResponse, 0, len(users))
	for i := range users {
		res = append(res, users[i].toResponse())
	}
	return res, nil
}
```

### 2. Operasi Mutasi Data (`Create`)
Untuk penulisan data (`INSERT`, `UPDATE`, `DELETE`), alur bisnis dieksekusi di dalam `WithTransactionCtx`. Pointer `tx` dioper secara eksplisit ke setiap method repository:

```go title="internal/module/user/service.go"
func (s *userService) Create(ctx context.Context, req *CreateUserRequest) (*UserResponse, error) {
	var res *UserResponse
	err := s.tm.WithTransactionCtx(ctx, func(tx *sqlx.Tx) error {
		// Validasi keberadaan email dalam transaksi
		exists, err := s.repo.ExistsByEmail(ctx, tx, req.Email)
		if err != nil {
			return appErrors.DatabaseError("Failed to check email existence", err)
		}
		if exists {
			return appErrors.EmailAlreadyExists()
		}

		user := &User{
			ID:        uuid.New().String(),
			Name:      req.Name,
			Email:     req.Email,
			Role:      "user",
			IsActive:  true,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Oper tx secara eksplisit ke repository
		if err := s.repo.Create(ctx, tx, user); err != nil {
			return appErrors.ParseDatabaseError(err)
		}

		u := user.toResponse()
		res = &u
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}
```

### 3. Repository Layer (Validasi Transaksi Wajib)
Setiap method repository memvalidasi keberadaan `tx` dan mengeksekusi query langsung pada objek transaksi tersebut:

```go title="internal/module/user/repository.go"
func (r *userRepository) Create(ctx context.Context, tx *sqlx.Tx, user *User) error {
	if tx == nil {
		return errors.New("transaction is required")
	}
	query := `INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := tx.ExecContext(ctx, query, user.ID, user.Name, user.Email, user.Phone, user.Role, user.IsActive, user.CreatedAt, user.UpdatedAt)
	return err
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
