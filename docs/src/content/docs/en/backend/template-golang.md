---
title: Golang (Fiber v2) Backend
description: Clean Architecture, pure parameter passing tx, sqlx, structured slog, and Swagger in template-golang
---

The `template-golang` starter kit is a high-performance REST API backend written in **Go 1.22+** utilizing the **Fiber v2** framework (Express.js-like ergonomics), enforcing strict Clean Architecture and transaction safety.

---

## ✨ Key Features

- **Fiber v2 Framework**: Fast HTTP routing engine built on Fasthttp with zero memory allocation paths.
- **Pure Parameter-Passing Transactions**: Database transactions must be passed explicitly via `tx *sqlx.Tx`. Storing transactions in `context.Context` is strictly forbidden.
- **sqlx Raw Queries**: Native, optimized SQL statements without complex ORM abstraction layers.
- **Structured slog Logger**: Centralized `pkg/logging` module emitting structured JSON lines (zero raw `fmt.Println` or `log.Println`).
- **Database Migrations**: Versioned database schemas powered by `golang-migrate/migrate`.
- **Centralized Error Parsing**: Automatic mapping of PostgreSQL/MySQL native database errors (unique conflicts, foreign key violations) into semantic API errors.
- **Interactive Swagger**: Fully integrated Swagger UI accessible at `http://localhost:8080/docs`.

---

## ⚡ Transaction Implementation Pattern (Pure Parameter Passing)

Per monorepo standard (`database-transactions.md`), transactions must be passed as explicit parameters:

```go title="internal/service/user_service.go"
func (s *UserService) Register(ctx context.Context, req *dto.RegisterRequest) (*dto.UserResponse, error) {
    // 1. Begin sqlx transaction
    tx, err := s.db.BeginTxx(ctx, nil)
    if err != nil {
        return nil, err
    }
    defer tx.Rollback() // Safe rollback on error or panic

    // 2. Explicitly pass tx to repository
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

    // 3. Commit transaction on success
    if err := tx.Commit(); err != nil {
        return nil, err
    }

    return dto.ToUserResponse(user), nil
}
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd backend

# Download Go dependencies
go mod download

# Run database migrations
make migrate-up

# Start development server (port 8080)
make dev
# or: go run cmd/api/main.go

# Run test suite
make test
```
