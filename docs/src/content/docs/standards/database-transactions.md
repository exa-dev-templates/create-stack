---
title: Standar Transaksi Database (Pure Parameter Passing)
description: Aturan keselamatan transaksi ACID lintas 5 backend (Go, Rust, TypeScript, Python, Java) tanpa magic context
---

Operasi mutasi data pada database (`INSERT`, `UPDATE`, `DELETE`) yang melibatkan lebih dari satu entitas, verifikasi relasi, atau multi-repository step **WAJIB** dieksekusi dalam batas transaksi ACID.

---

## 🚫 Larangan Keras: Context-Hidden Transactions

- **Pada Go**: ❌ **DILARANG KERAS** menyimpan pointer transaksi (`*sqlx.Tx`) ke dalam `context.Context` (misalnya via `context.WithValue` atau middleware otomatis). Pola ini menyembunyikan dependensi, menghilangkan *compile-time safety*, dan rentan memicu kebocoran koneksi pool.
- **Pada Rust**: ❌ **DILARANG KERAS** menyembunyikan objek `sqlx::Transaction` di dalam thread-local atau task-local storage.
- **Pada TypeScript / Python**: ❌ **DILARANG KERAS** melakukan auto-commit di layer repository individual. Commit wajib diorkestrasikan secara transparan di layer service/handler.

---

## 🛡️ Standar Implementasi di 5 Bahasa Backend

### 1. Go (Fiber v2 + sqlx) — `TransactionManager` & Pure Parameter Passing
Modul [database.TransactionManager](file:///Users/macbookair/develop/templates/template-golang/database/postgres.go#L308-L312) mengelola lifecycle transaksi, panic recovery, dan rollback secara otomatis, sementara pointer `tx *sqlx.Tx` dioper secara eksplisit ke repository:

```go title="internal/module/user/service.go"
func (s *userService) Create(ctx context.Context, req *CreateUserRequest) (*UserResponse, error) {
	var res *UserResponse
	err := s.tm.WithTransactionCtx(ctx, func(tx *sqlx.Tx) error {
		// 1. Oper tx eksplisit ke repository
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

		// 2. Oper tx ke operasi penulisan
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

Repository memvalidasi keberadaan `tx`:
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
Transaksi dibuka melalui pool dan dioper murni via mutable borrow `&mut Transaction<'_, Postgres>`:

```rust title="src/modules/user/service.rs"
pub async fn update_user(
    &self,
    id: Uuid,
    req: UpdateUserRequest,
) -> Result<UserResponse, AppError> {
    // 1. Buka transaksi dari PgPool
    let mut tx = self.pool.begin().await.map_err(AppError::Database)?;

    // 2. Oper &mut tx ke repository utama
    let updated_user = self.repo.update(&mut tx, id, &req).await?;

    // 3. Cascading multi-repository dalam transaksi yang sama
    if let Some(false) = req.is_active {
        self.auth_repo.revoke_all_user_tokens(&mut tx, id).await?;
    }

    // 4. Commit eksplisit jika semua tahap sukses
    tx.commit().await.map_err(AppError::Database)?;

    Ok(updated_user)
}
```

Trait Repository mewajibkan signature `&mut Transaction`:
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
Menggunakan closure helper `Database.getInstance().withTransaction` yang mengontrol lifecycle koneksi pool client, `BEGIN`, `COMMIT`, dan auto-`ROLLBACK`:

```typescript title="src/modules/users/service.ts"
export class UserService {
  async createUser (data: CreateUserDTO): Promise<User> {
    const db = Database.getInstance()
    return await db.withTransaction(async (client) => {
      // 1. Oper client transaksi ke check query
      const existingUser = await userRepository.findByEmail(data.email, client)
      if (existingUser) {
        throw new EmailAlreadyExistsError('Email already exists', { field: 'email' })
      }

      // 2. Oper client transaksi ke insert query
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
Transaksi diatur secara deklaratif melalui decorator `@transactional` di level handler router atau melalui `async with session.begin()` di service:

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

Repository beroperasi pada `AsyncSession` tanpa auto-commit:
```python title="modules/users/repository.py"
class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> UserRecord:
        # Menulis ke database tanpa commit; di-commit oleh @transactional
        query = text("INSERT INTO users (...) VALUES (...) RETURNING ...")
        result = await self.db.execute(query, kwargs)
        return dict(result.mappings().first())
```

---

### 5. Java (Spring Boot 4) — `@Transactional` & `@Transactional(readOnly = true)`
Dikelola melalui proxy AOP Spring Framework dengan pembagian mutasi dan read-only yang jelas:

```java title="src/main/java/com/example/template/java/user/service/UserService.java"
@Service
public class UserService {

    private final UserRepository userRepository;

    // Mutasi data: Rollback otomatis jika runtime exception / BusinessException
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

    // Query data: Dioptimalkan untuk Hibernate dirty-checking
    @Transactional(readOnly = true)
    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }
}
```
