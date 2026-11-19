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

## ⚡ Transaction Implementation Pattern

Transactions are managed through explicit `AsyncSession` parameter passing:

```python title="app/services/user_service.py"
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository
from app.pkg.errors import AppError

class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def register_user(self, session: AsyncSession, user_data: dict):
        async with session.begin():
            existing = await self.user_repo.find_by_email(session, user_data["email"])
            if existing:
                raise AppError(code="EMAIL_ALREADY_EXISTS", message="Email already registered", status_code=409)

            user = await self.user_repo.create(session, user_data)
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
