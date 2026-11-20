---
title: FastAPI Async (Python) Backend
description: Clean Architecture, Raw SQL queries, Pydantic v2, Alembic, SSE, WebSocket, Redis PubSub, RabbitMQ, dan Kafka di template-fastapi-async
---

Template `template-fastapi-async` adalah backend REST API berkecepatan tinggi berbasis **Python 3.10+** dan **FastAPI**, memanfaatkan eksekusi asynchronous (`asyncio`), query SQL langsung teroptimasi tanpa overhead ORM berat, sistem antrean pesan ganda, dan engine realtime terdistribusi.

---

## ✨ Fitur Arsitektur Utama

- **FastAPI Asynchronous & Non-Blocking**: Menggunakan `async`/`await` end-to-end dengan driver `asyncpg` untuk mencapai throughput concurrency optimal.
- **Raw SQL Queries (Repository Pattern)**: Query SQL mentah yang teroptimasi tanpa beban overhead ORM, menjamin kontrol penuh atas index dan query performance.
- **Pydantic v2 & Unified Validation**: Validasi data input super cepat berbasis skema model Python modern dan helper dependency `validate_body`.
- **Database Transactions Declarative**: Orkestrasi batas atomisitas transaksi menggunakan decorator `@transactional` dan `@read_only`.
- **Dual Realtime Protocols (SSE & WebSockets)**:
  - **Server-Sent Events (SSE)** via `sse-starlette` pada `/sse/stream` dan `/sse/notifications`.
  - **WebSocket** native FastAPI pada `/ws/connect` dan `/ws/notifications` dengan autentikasi token handshake.
- **Distributed Realtime Bridge**: Sinkronisasi event multi-worker/multi-pod Kubernetes menggunakan Redis Pub/Sub (`ws_broadcast` & `sse_broadcast`).
- **Dual Message Brokers (RabbitMQ & Kafka)**:
  - RabbitMQ asynchronous producer via `aio-pika`.
  - Apache Kafka asynchronous producer via `aiokafka`.
- **Structured JSON Logging**: Modul `lib/logger.py` terpusat yang menghasilkan output log JSON per baris (dilarang keras menggunakan `print()`).
- **OpenAPI 3.0 Documentation**: Swagger UI interaktif di `http://localhost:8000/docs` dan ReDoc di `/redoc`.

---

## ⚡ Transaksi Database (Pure Parameter Passing)

Di template `template-fastapi-async`, repository layer **tidak melakukan auto-commit** agar konsistensi operasi multi-tabel terjaga. Batas transaksi diorkestrasikan secara bersih via decorator `@transactional` dan `@read_only` di router handler (atau manual `async with session.begin()`), sementara objek `db: AsyncSession` dioper secara eksplisit ke service dan repository:

### 1. Operasi Pembacaan / Read-Only

Untuk operasi pembacaan data, decorator `@read_only` memastikan session query dieksekusi tanpa overhead flush:

```python title="modules/users/routes.py"
@router.get("/{user_id}", response_model=BaseResponse[UserResponse])
@read_only
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    user = await service.get_user_by_id(user_id)
    return success_response(data=user, message="User retrieved")
```

### 2. Operasi Mutasi Data & Atomic Rollback

Untuk operasi penulisan data (`INSERT`, `UPDATE`, `DELETE`), decorator `@transactional` memastikan atomisitas dan auto-rollback jika terjadi exception:

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
    data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Membuat user baru di dalam transaksi database atomik.
    Rollback otomatis dieksekusi jika terjadi exception.
    """
    service = UserService(db)
    user = await service.create_user(data)
    return success_response(
        data=user,
        message="User successfully registered",
        code="USER_CREATED"
    )
```

### 3. Layer Repository

Pada layer repository, query dieksekusi murni via koneksi `db: AsyncSession`:

```python title="modules/users/repository.py"
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from modules.users.models import User

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_by_email(self, email: str) -> Optional[User]:
        query = text("SELECT id, email, password_hash, role, created_at FROM users WHERE email = :email LIMIT 1")
        result = await self.db.execute(query, {"email": email})
        row = result.mappings().first()
        return User(**row) if row else None

    async def create(self, user: User) -> User:
        query = text("""
            INSERT INTO users (email, password_hash, role)
            VALUES (:email, :password_hash, :role)
            RETURNING id, email, role, created_at
        """)
        result = await self.db.execute(query, {
            "email": user.email,
            "password_hash": user.password_hash,
            "role": user.role
        })
        row = result.mappings().first()
        return User(**row)
```

---

## 📡 Real-time Engine: SSE, WebSocket & Distributed Bridge

FastAPI template menyediakan endpoint SSE dan WebSocket yang terintegrasi langsung dengan Redis Pub/Sub untuk penskalaan multi-instance (Kubernetes Pods):

```mermaid
flowchart TD
    Client1["SSE Client (EventSource)"] -->|GET /sse/stream?channel=news| API1["FastAPI Pod 1"]
    Client2["WebSocket Client"] -->|ws:// /ws/connect?token=...| API2["FastAPI Pod 2"]
    
    API1 -->|Publish Event| Redis["Redis Pub/Sub Engine\n(sse_broadcast / ws_broadcast)"]
    Redis -->|Dispatch Payload| API1
    Redis -->|Dispatch Payload| API2
    
    API1 -->|Stream Event| Client1
    API2 -->|Send Frame| Client2
```

### 1. Server-Sent Events (SSE)
Menggunakan `sse-starlette` dan `SSEManager` (`lib/sse_manager.py`). Koneksi dipertahankan via antrean asynchronous (`asyncio.Queue`) per subscriber:

```javascript title="Contoh Client SSE (Browser / Frontend)"
const eventSource = new EventSource('http://localhost:8000/sse/stream?channel=orders');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Realtime Event:', data);
};

eventSource.addEventListener('notification', (event) => {
  console.log('User Notification:', JSON.parse(event.data));
});

eventSource.onerror = (err) => {
  console.error('SSE Error:', err);
  eventSource.close();
};
```

### 2. Full-Duplex WebSocket
WebSocket dikelola oleh `ConnectionManager` (`lib/websocket_manager.py`) dengan autentikasi berbasis query param token:

```javascript title="Contoh Client WebSocket (Browser / Node.js)"
const socket = new WebSocket('ws://localhost:8000/ws/connect?channel=chat&token=' + accessToken);

socket.onopen = () => {
  console.log('Connected to WebSocket server');
  socket.send(JSON.stringify({ action: 'ping' }));
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received Message:', message);
};
```

### 3. Distributed Auto-Bridge (Horizontal Scaling)
Untuk penskalaan multi-pod di Kubernetes, seluruh koneksi SSE dan WebSocket dihubungkan via Redis Pub/Sub:
- Worker berlangganan ke channel Redis `ws_broadcast` dan `sse_broadcast`.
- Saat sebuah node mem-publish event realtime, seluruh node menerima event dan mem-forward ke client lokalnya masing-masing.

### 4. Daftar Endpoint Realtime

| Method / Protocol | Endpoint | Deskripsi | Autentikasi |
|---|---|---|---|
| `GET` (SSE) | `/sse/stream` | Langganan stream channel publik SSE (`?channel=default`) | Terbuka |
| `GET` (SSE) | `/sse/notifications` | Stream notifikasi privat pengguna terautentikasi | Wajib (Bearer) |
| `GET` (SSE) | `/sse/stats` | Informasi statistik koneksi dan channel SSE aktif | Terbuka |
| `WS` (WebSocket) | `/ws/connect` | Koneksi WebSocket channel publik (`?channel=chat&token=...`) | Opsional (Token Query) |
| `WS` (WebSocket) | `/ws/notifications` | Koneksi notifikasi pribadi berbasis user ID | Wajib (Token Query) |
| `GET` | `/ws/stats` | Informasi statistik koneksi WebSocket per channel & user | Terbuka |

---

## 🐰⚡ Dual Message Broker: RabbitMQ & Apache Kafka

Template mendukung pengiriman event ke antrean pesan enterprise secara non-blocking:

### 1. RabbitMQ Producer & Consumer
Menggunakan `aio-pika` untuk koneksi non-blocking ke RabbitMQ:

```python title="modules/rabbitmq/service.py"
from modules.rabbitmq.service import RabbitMQService

rabbitmq = RabbitMQService()
await rabbitmq.publish_message(
    queue_name="order_processing",
    message={"order_id": "ORD-5541", "amount": 150000}
)
```

### 2. Apache Kafka Producer
Menggunakan `aiokafka` untuk mengirim event record ke Kafka topic:

```python title="lib/kafka_client.py"
from lib.kafka_client import kafka_client

await kafka_client.publish_message(
    topic="app.events",
    message={"event": "USER_REGISTERED", "user_id": 42},
    key="user-42"
)
```

### 3. Daftar Endpoint & Testing cURL

```bash title="cURL Publish ke RabbitMQ & Kafka"
# RabbitMQ Publish
curl -X POST http://localhost:8000/rabbitmq/publish \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "email_queue",
    "message": { "to": "user@example.com", "subject": "Welcome!" }
  }'

# Apache Kafka Publish
curl -X POST http://localhost:8000/kafka-send \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "analytics-events",
    "key": "device-01",
    "message": { "action": "CLICK", "element": "btn-checkout" }
  }'
```

---

## 🛡️ Proteksi Idempotency (X-Idempotency-Key)

`template-fastapi-async` dilengkapi middleware idempotency terdistribusi penuh (`middleware/idempotency.py`) yang mengimplementasikan spesifikasi IETF draft:

### 1. Konfigurasi Middleware & Storage

```python title="main.py"
from middleware.idempotency import IdempotencyMiddleware, RedisIdempotencyStorage

# Registrasi middleware idempotency terdistribusi ke FastAPI
app.add_middleware(
    IdempotencyMiddleware,
    storage=RedisIdempotencyStorage(),
    lifetime_seconds=86400,     # Simpan response cache selama 24 jam
    timeout_seconds=30          # Lock in-flight request selama 30 detik
)
```

Untuk mewajibkan header `Idempotency-Key` pada endpoint tertentu:

```python title="modules/users/routes.py"
from fastapi import APIRouter, Depends
from middleware.idempotency import require_idempotency_key

router = APIRouter(prefix="/users", tags=["Users"])

@router.post(
    "",
    response_model=BaseResponse[UserResponse],
    dependencies=[Depends(require_idempotency_key)]
)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return success_response(await service.create_user(data))
```

### 2. Mekanisme Kunci, Fingerprint & Replay
1. **Pemeriksaan Header**: Memeriksa header `Idempotency-Key` atau `X-Idempotency-Key`.
2. **Distributed Lock Redis**: Menggunakan Redis `SET NX EX` untuk mengunci key selama 30 detik. Request paralel yang bersamaan akan menerima HTTP `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
3. **Payload Fingerprint SHA-256**: Mengkalkulasi fingerprint dari `user_id + method + path + body`. Jika key sama dikirim dengan payload berbeda, server mengembalikan `422 Unprocessable Entity` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
4. **Instant Replay**: Response yang tersimpan di-replay langsung tanpa mengeksekusi ulang route handler, disertai header `Idempotent-Replayed: true`.
5. **Auto Unlock on 5xx**: Jika terjadi error server (HTTP 500+), lock otomatis dihapus dari Redis agar client dapat mencoba kembali (*retry safely*).

---

## 🚦 Dual-Tier Rate Limiting & Proteksi DoS

`template-fastapi-async` mengintegrasikan `RateLimiterMiddleware` di `middleware/rate_limiter.py`:

### 1. Tingkatan Proteksi: Global API vs Strict Auth

1. **Global Rate Limiter**:
   - Membatasi request umum dengan kuota `RATE_LIMIT_MAX` (default: 100 req / 60 detik per IP).
   - Diaktifkan secara global di `app.py`: `app.add_middleware(RateLimiterMiddleware)`.
   - Mengabaikan (*whitelist*) route `/health`, `/`, `/docs`, `/redoc`, dan `/openapi.json`.
2. **Strict Auth Limiter**:
   - Membatasi route autentikasi (`/auth/login`, `/auth/register`) dari serangan *brute force*.
   - Kuota ketat `RATE_LIMIT_AUTH_MAX` (default: 5 req / 60 detik).
   - Key generator komposit: `rl:auth:{client_ip}:{path}`.

### 2. Header Standar RFC 6585 & Storage Hybrid

- **Header RFC 6585**: Menyertakan `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan `Retry-After` (saat HTTP 429).
- **Format Response**: Mengembalikan status `429 Too Many Requests` envelope `error_response(message, code=RATE_LIMIT_EXCEEDED)`.
- **Hybrid Storage**: Menggunakan pipeline atomic Redis (`INCR` + `EXPIRE`) jika `RATE_LIMIT_STORAGE=redis`, dan otomatis *fallback* ke `_memory_store` berbasis `asyncio.Lock` jika Redis tidak tersedia.

---

## 📋 Validasi Input Request & Boundaries

Validasi Pydantic v2 memastikan request body divalidasi keamanannya sebelum dieksekusi:

```python title="modules/users/schemas.py"
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=2, max_length=100)
    role: str = Field(default="user")
```

---

## ⚙️ Variabel Lingkungan & Konfigurasi

```ini title=".env"
# Application Settings
ENVIRONMENT=development
PORT=8000
DEBUG=true

# Database (PostgreSQL Async)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/template_fastapi_db
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20

# JWT Auth
SECRET_KEY=super-secret-jwt-key-minimum-32-chars-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis (Cache & Realtime PubSub)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_ENABLED=true
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Apache Kafka
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=app.events
KAFKA_CLIENT_ID=fastapi-service
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-fastapi-async

# Buat virtualenv & aktifkan
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Jalankan migrasi database Alembic
alembic upgrade head

# Jalankan server dalam mode development
uvicorn main:app --reload --port 8000

# Jalankan test suite pytest
pytest
```
