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

## ⚡ Real-World Transaction Pattern (TransactionManager & Pure Parameter Passing)

Following the monorepo standard (`database-transactions.md`), this template strictly prohibits "magic context" and avoids repetitive `BeginTxx / defer tx.Rollback / Commit` boilerplate in every service method. Instead, `database.TransactionManager` (`s.tm`) manages transaction lifecycle safely (with panic recovery & context cancellation) while enforcing **pure parameter passing (`tx *sqlx.Tx`)** to the repository layer.

### 1. Read-Only Operations (`GetAll`)
For query operations, the service uses `WithReadOnlyTransactionCtx`:

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

### 2. Mutation Operations (`Create`)
For write operations (`INSERT`, `UPDATE`, `DELETE`), business logic is wrapped in `WithTransactionCtx`. The `tx` pointer is explicitly forwarded to all repository methods:

```go title="internal/module/user/service.go"
func (s *userService) Create(ctx context.Context, req *CreateUserRequest) (*UserResponse, error) {
	var res *UserResponse
	err := s.tm.WithTransactionCtx(ctx, func(tx *sqlx.Tx) error {
		// Verify email uniqueness inside the transaction
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

		// Explicitly pass tx to repository
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

### 3. Repository Layer (Enforcing Mandatory Transaction)
Every repository method validates that `tx` is non-nil and runs queries directly on `tx`:

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
