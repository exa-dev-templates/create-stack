---
title: FastAPI Async (Python) Backend
description: Clean Architecture, Raw SQL queries, Pydantic v2, Alembic, and SSE/WebSocket in template-fastapi-async
---

The `template-fastapi-async` starter kit is a high-throughput REST API backend built on **Python 3.10+** and **FastAPI**, leveraging asynchronous execution (`async`/`await`), raw SQL queries without ORM bloat, and a structured Repository Pattern.

---

## ✨ Key Features

- **Asynchronous Execution**: Fully non-blocking architecture using `asyncio` and `asyncpg` for maximum request concurrency.
- **Raw SQL Queries (Repository Pattern)**: Direct SQL execution through connection pools for predictable, optimized query performance.
- **Pydantic v2**: High-performance data validation and serialization based on modern Python type hints.
- **Realtime Ready**: Built-in **Server-Sent Events (SSE)** and **WebSocket** endpoints scalable across containers with Redis Pub/Sub.
- **Structured JSON Logging**: Centralized `logger.py` formatting structured JSON records per line (zero `print()` calls).
- **Database Migrations**: Declarative schema management using **Alembic**.
- **Interactive OpenAPI**: Real-time Swagger UI docs at `http://localhost:8000/docs`.

---

## ⚡ Real-World Transaction Pattern (`@transactional` & `AsyncSession`)

In `template-fastapi-async`, repository operations **never auto-commit** to guarantee consistency across multi-step flows. Transaction boundaries are managed declaratively via `@transactional` decorator at the router handler level (or explicitly via `async with session.begin()` / `await db.commit()`), while `db: AsyncSession` is explicitly passed through services and repositories:

```python title="modules/users/routes.py"
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from lib.database import get_db
from utils.decorators import transactional, read_only
from core.responses import BaseResponse, success_response
from modules.users.service import UserService
from modules.users.schemas import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("", response_model=BaseResponse[UserResponse], status_code=status.HTTP_201_CREATED)
@transactional
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new user within an automated transaction boundary.
    @transactional automatically commits on success and rolls back on unhandled exceptions.
    """
    user_service = UserService(db)
    user = await user_service.create_user(
        email=user_data.email,
        username=user_data.username,
        password=user_data.password,
        full_name=user_data.full_name,
        role=user_data.role or "user"
    )

    return success_response(
        message="User created successfully",
        data=user,
        code="USER_CREATED"
    )
```

At the service layer ([modules/users/service.py](file:///Users/macbookair/develop/templates/template-fastapi-async/modules/users/service.py#L27-L85)), business logic validates state before invoking repository operations:

```python title="modules/users/service.py"
from sqlalchemy.ext.asyncio import AsyncSession
from modules.users.repository import UserRepository
from exceptions import ConflictException, DatabaseException
from constants import EMAIL_ALREADY_EXISTS, USER_ALREADY_EXISTS, DATABASE_ERROR

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)

    async def create_user(self, email: str, username: str, password: str, full_name: str = None, role: str = "user"):
        # 1. Verify existence within the active session
        if await self.user_repo.user_exists(email=email):
            raise ConflictException(message="User with this email already exists", code=EMAIL_ALREADY_EXISTS)

        if await self.user_repo.user_exists(username=username):
            raise ConflictException(message="User with this username already exists", code=USER_ALREADY_EXISTS)

        # 2. Execute repository write (no internal auto-commit)
        user = await self.user_repo.create(
            email=email,
            username=username,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role
        )

        if not user:
            raise DatabaseException(message="Failed to create user", code=DATABASE_ERROR)

        return user
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server (port 8000)
uvicorn app.main:app --reload --port 8000
```
