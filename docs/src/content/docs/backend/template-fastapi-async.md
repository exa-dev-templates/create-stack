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

## ⚡ Contoh Implementasi Transaction

Transaksi database dijalankan dengan pola passing `AsyncSession`:

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
