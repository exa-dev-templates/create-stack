---
title: FastAPI Async (Python) Backend
description: Clean Architecture, Raw SQL queries, Pydantic v2, Alembic, dan SSE/WebSocket di template-fastapi-async
---

Template `template-fastapi-async` adalah backend REST API berkecepatan tinggi berbasis **Python 3.10+** dan **FastAPI**, memanfaatkan eksekusi asynchronous (`async`/`await`), query SQL langsung (raw queries) tanpa ORM berat, dan arsitektur repositori terstruktur.

---

## ✨ Fitur Utama

- **FastAPI Asynchronous**: Arsitektur non-blocking menggunakan `asyncio` dan `asyncpg` untuk throughput maksimal.
- **Raw SQL Queries (Repository Pattern)**: Menggunakan koneksi pool async SQLAlchemy/asyncpg untuk menjalankan query SQL mentah yang teroptimasi tanpa beban overhead ORM.
- **Pydantic v2**: Serialisasi dan validasi data berbasis skema type hints Python modern yang sangat cepat.
- **Realtime Capabilities**: Dilengkapi endpoint **Server-Sent Events (SSE)** dan **WebSocket** yang dapat diskalakan lintas kontainer dengan Redis Pub/Sub.
- **Structured JSON Logging**: Modul `logger.py` terpusat yang menghasilkan output log JSON per baris (bebas dari fungsi `print()`).
- **Database Migrations**: Dikelola secara deklaratif menggunakan **Alembic**.
- **Interactive OpenAPI**: Dokumentasi Swagger UI interaktif di `http://localhost:8000/docs`.

---

## ⚡ Implementasi Transaksi Nyata (`@transactional` & `AsyncSession`)

Di template `template-fastapi-async`, repository layer **tidak melakukan auto-commit** agar konsistensi multi-operation tetap terjaga. Batas transaksi diorkestrasikan secara bersih via decorator `@transactional` di router handler (atau manual `async with session.begin()` / `await db.commit()`), sementara objek `db: AsyncSession` dioper ke service dan repository:

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
    Membuat user baru di dalam batas transaksi otomatis.
    @transactional akan auto-commit jika sukses, dan auto-rollback jika terjadi exception.
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

Pada layer service ([modules/users/service.py](file:///Users/macbookair/develop/templates/template-fastapi-async/modules/users/service.py#L27-L85)), alur bisnis memvalidasi kondisi sebelum memanggil repository:

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
        # 1. Validasi keberadaan user dalam sesi yang sama
        if await self.user_repo.user_exists(email=email):
            raise ConflictException(message="User with this email already exists", code=EMAIL_ALREADY_EXISTS)

        if await self.user_repo.user_exists(username=username):
            raise ConflictException(message="User with this username already exists", code=USER_ALREADY_EXISTS)

        # 2. Eksekusi penulisan repository (tanpa auto-commit internal)
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

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd backend

# Buat dan aktifkan virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependensi
pip install -r requirements.txt

# Jalankan migrasi database
alembic upgrade head

# Jalankan server development (port 8000)
uvicorn app.main:app --reload --port 8000
```
