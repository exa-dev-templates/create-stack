---
title: Database Transactions Standard (Pure Parameter Passing)
description: ACID transaction safety rules across 5 backend stacks (Go, Rust, TypeScript, Python, Java) without magic context
---

Database mutation operations (`INSERT`, `UPDATE`, `DELETE`) involving multiple entities, foreign key verifications, or multi-repository steps **MUST** execute within an ACID transaction boundary.

---

## 🚫 Strictly Forbidden: Context-Hidden Transactions

- **In Go**: ❌ **STRICTLY PROHIBITED** to store transaction pointers (`*sqlx.Tx`) inside `context.Context` (such as via `context.WithValue` or automatic middleware). This pattern hides dependencies, eliminates compile-time safety, and leads to connection pool leaks.
- **In Rust**: ❌ **STRICTLY PROHIBITED** to hide `sqlx::Transaction` inside thread-local or task-local storage.
- **In TypeScript / Python**: ❌ **STRICTLY PROHIBITED** to auto-commit inside individual repository methods. Commits must be orchestrated transparently at the service or handler layer.

---

## 🛡️ Implementation Patterns Across 5 Backend Stacks

### 1. Go (Fiber v2 + sqlx) — `TransactionManager` & Pure Parameter Passing
The [database.TransactionManager](file:///Users/macbookair/develop/templates/template-golang/database/postgres.go#L308-L312) manages transaction lifecycle, panic recovery, and rollbacks automatically, while `tx *sqlx.Tx` is explicitly passed to repository methods:

```go title="internal/module/user/service.go"
func (s *userService) Create(ctx context.Context, req *CreateUserRequest) (*UserResponse, error) {
	var res *UserResponse
	err := s.tm.WithTransactionCtx(ctx, func(tx *sqlx.Tx) error {
		// 1. Explicitly pass tx to repository query
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

		// 2. Explicitly pass tx to insert operation
		if err := s.repo.Create(ctx, tx, user); err != nil {
			return appErrors.ParseDatabaseError(err)
		}

		u := user.toResponse()
		res = &u
		return nil
	})
	return res, err
}
```

Repository validates that `tx` is not nil:
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

### 2. Rust (Axum 0.7 + SQLx) — Mutable Reference (`&mut Transaction`)
Transactions are initiated on the pool and forwarded purely via mutable borrow `&mut Transaction<'_, Postgres>`:

```rust title="src/modules/user/service.rs"
pub async fn update_user(
    &self,
    id: Uuid,
    req: UpdateUserRequest,
) -> Result<UserResponse, AppError> {
    // 1. Begin transaction from PgPool
    let mut tx = self.pool.begin().await.map_err(AppError::Database)?;

    // 2. Pass &mut tx to primary repository
    let updated_user = self.repo.update(&mut tx, id, &req).await?;

    // 3. Multi-repository cascading within the same transaction
    if let Some(false) = req.is_active {
        self.auth_repo.revoke_all_user_tokens(&mut tx, id).await?;
    }

    // 4. Explicit commit upon success
    tx.commit().await.map_err(AppError::Database)?;

    Ok(updated_user)
}
```

Repository traits enforce the `&mut Transaction` signature:
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

### 3. TypeScript (Express + pg) — `withTransaction(client)`
Uses the closure helper `Database.getInstance().withTransaction` managing client checkout, `BEGIN`, `COMMIT`, and auto-`ROLLBACK`:

```typescript title="src/modules/users/service.ts"
export class UserService {
  async createUser (data: CreateUserDTO): Promise<User> {
    const db = Database.getInstance()
    return await db.withTransaction(async (client) => {
      // 1. Pass client into verification query
      const existingUser = await userRepository.findByEmail(data.email, client)
      if (existingUser) {
        throw new EmailAlreadyExistsError('Email already exists', { field: 'email' })
      }

      // 2. Pass client into insertion query
      return await userRepository.create(
        {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          role: data.role
        },
        client
      )
    })
  }
}
```

---

### 4. Python (FastAPI + SQLAlchemy Async) — `@transactional` Decorator
Transactions are managed declaratively using the `@transactional` decorator at the router handler level or via `async with session.begin()` in service code:

```python title="modules/users/routes.py"
@router.post("", response_model=BaseResponse[UserResponse], status_code=status.HTTP_201_CREATED)
@transactional
async def create_user(
    user_data: UserCreate = Depends(validate_body(UserCreate)),
    db: AsyncSession = Depends(get_db)
):
    user_service = UserService(db)
    user = await user_service.create_user(
        email=user_data.email,
        username=user_data.username,
        password=user_data.password,
        full_name=user_data.full_name,
        role=user_data.role or "user"
    )
    return success_response(message="User created successfully", data=user, code=CREATED)
```

Repository executes on `AsyncSession` without auto-commit:
```python title="modules/users/repository.py"
class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> UserRecord:
        # Executes within the active transaction; committed by @transactional
        query = text("INSERT INTO users (...) VALUES (...) RETURNING ...")
        result = await self.db.execute(query, kwargs)
        return dict(result.mappings().first())
```

---

### 5. Java (Spring Boot 4) — `@Transactional` & `@Transactional(readOnly = true)`
Managed by Spring AOP transaction proxy with distinct separation between mutations and queries:

```java title="src/main/java/com/example/template/java/user/service/UserService.java"
@Service
public class UserService {

    private final UserRepository userRepository;

    // Mutation: Automatic rollback on runtime exception or BusinessException
    @Transactional
    public User createUser(UserRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BusinessException("Email already exists", ApiCode.EMAIL_ALREADY_EXISTS, 409);
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(BCrypt.hashpw(request.getPassword(), BCrypt.gensalt()));

        return userRepository.save(user);
    }

    // Query: Optimized for Hibernate dirty-checking bypass
    @Transactional(readOnly = true)
    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }
}
```
