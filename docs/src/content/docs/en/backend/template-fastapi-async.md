---
title: FastAPI Async (Python) Backend
description: Clean Architecture, Raw SQL queries, Pydantic v2, Alembic, SSE, WebSocket, Redis PubSub, RabbitMQ, and Kafka in template-fastapi-async
---

The `template-fastapi-async` template is a high-speed asynchronous REST API backend built on **Python 3.10+** and **FastAPI**, leveraging asynchronous execution (`asyncio`), raw optimized SQL queries without heavyweight ORM overhead, dual message brokers, and a distributed realtime engine.

---

## ✨ Core Architectural Features

- **FastAPI Asynchronous & Non-Blocking**: End-to-end `async`/`await` powered by the `asyncpg` PostgreSQL driver for peak concurrent throughput.
- **Raw SQL Queries (Repository Pattern)**: Raw optimized SQL queries executed over async connection pools, providing full control over execution plans and indexes.
- **Pydantic v2 & Unified Validation**: Ultra-fast request schema validation utilizing Python type hints and the custom `validate_body` dependency.
- **Declarative Database Transactions**: Clean boundary management using `@transactional` and `@read_only` decorators.
- **Dual Realtime Protocols (SSE & WebSockets)**:
  - **Server-Sent Events (SSE)** via `sse-starlette` on `/sse/stream` and `/sse/notifications`.
  - Native FastAPI **WebSockets** on `/ws/connect` and `/ws/notifications` with token handshake validation.
- **Distributed Realtime Bridge**: Cross-worker and cross-pod event synchronization backed by Redis Pub/Sub (`ws_broadcast` & `sse_broadcast`).
- **Dual Message Brokers (RabbitMQ & Kafka)**:
  - Asynchronous RabbitMQ producer powered by `aio-pika`.
  - Asynchronous Apache Kafka producer powered by `aiokafka`.
- **Structured JSON Logging**: Centralized `lib/logger.py` module generating one JSON log line per event (raw `print()` calls are strictly forbidden).
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI at `http://localhost:8000/docs` and ReDoc at `/redoc`.

---

## ⚡ Database Transactions (Pure Parameter Passing)

In `template-fastapi-async`, repository methods **do not auto-commit**, ensuring consistency across multi-table operations. Transaction boundaries are declaratively managed via `@transactional` and `@read_only` decorators, passing `db: AsyncSession` explicitly to services and repositories:

### 1. Read-Only Operations

For data queries, `@read_only` ensures session queries execute without flush overhead:

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

### 2. Data Mutations & Atomic Rollback

For write operations (`INSERT`, `UPDATE`, `DELETE`), `@transactional` enforces atomic transactions and automatic rollbacks on unhandled exceptions:

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
    Creates a new user within an atomic database transaction.
    Rollbacks are automatically executed if an unhandled exception occurs.
    """
    service = UserService(db)
    user = await service.create_user(data)
    return success_response(
        data=user,
        message="User successfully registered",
        code="USER_CREATED"
    )
```

### 3. Repository Layer

At the repository level, queries execute directly on `db: AsyncSession`:

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

The FastAPI template provides robust SSE and WebSocket capabilities tightly integrated with Redis Pub/Sub for seamless horizontal scaling across Kubernetes Pods:

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
Built with `sse-starlette` and `SSEManager` (`lib/sse_manager.py`). Persistent connections stream events via dedicated asynchronous queues (`asyncio.Queue`):

```javascript title="Client SSE Example (Browser / Frontend)"
const eventSource = new EventSource('http://localhost:8000/sse/stream?channel=orders');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Realtime Event:', data);
};

eventSource.onerror = (err) => {
  console.error('SSE Error:', err);
  eventSource.close();
};
```

### 2. Full-Duplex WebSocket
WebSockets are orchestrated through `ConnectionManager` (`lib/websocket_manager.py`) with optional JWT authentication via query parameters:

```javascript title="Client WebSocket Example (Browser / Node.js)"
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
Across Kubernetes pods, Redis Pub/Sub bridges all connections:
- Pods subscribe to Redis channels `ws_broadcast` and `sse_broadcast`.
- When an event is emitted, all pods receive the payload and dispatch it to their local socket connections.

### 4. Realtime API Endpoints

| Method / Protocol | Endpoint | Description | Authentication |
|---|---|---|---|
| `GET` (SSE) | `/sse/stream` | Subscribe to a public SSE channel (`?channel=default`) | Public |
| `GET` (SSE) | `/sse/notifications` | Private user notification stream | Required (Bearer) |
| `GET` (SSE) | `/sse/stats` | Active SSE connections and subscriber metrics | Public |
| `WS` (WebSocket) | `/ws/connect` | Public WebSocket connection (`?channel=chat&token=...`) | Optional (Token Query) |
| `WS` (WebSocket) | `/ws/notifications` | Private user notification WebSocket channel | Required (Token Query) |
| `GET` | `/ws/stats` | Active WebSocket connections per channel and user | Public |

---

## 🐰⚡ Dual Message Brokers: RabbitMQ & Apache Kafka

The backend template supports high-throughput non-blocking event publishing across both enterprise brokers:

### 1. RabbitMQ Producer & Consumer
Powered by `aio-pika` for async AMQP communication:

```python title="modules/rabbitmq/service.py"
from modules.rabbitmq.service import RabbitMQService

rabbitmq = RabbitMQService()
await rabbitmq.publish_message(
    queue_name="order_processing",
    message={"order_id": "ORD-5541", "amount": 150000}
)
```

### 2. Apache Kafka Producer
Driven by `aiokafka` for streaming records to Apache Kafka:

```python title="lib/kafka_client.py"
from lib.kafka_client import kafka_client

await kafka_client.publish_message(
    topic="app.events",
    message={"event": "USER_REGISTERED", "user_id": 42},
    key="user-42"
)
```

### 3. Broker Endpoints & Testing cURL

```bash title="cURL Publish to RabbitMQ & Kafka"
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

## 🛡️ Idempotency Protection (X-Idempotency-Key)

`template-fastapi-async` provides production-grade distributed idempotency middleware (`middleware/idempotency.py`) implementing the IETF draft specification:

### 1. Middleware & Storage Configuration

```python title="main.py"
from middleware.idempotency import IdempotencyMiddleware, RedisIdempotencyStorage

# Register distributed idempotency middleware
app.add_middleware(
    IdempotencyMiddleware,
    storage=RedisIdempotencyStorage(),
    lifetime_seconds=86400,     # Cache response for 24 hours
    timeout_seconds=30          # Lock in-flight request for 30 seconds
)
```

To enforce the `Idempotency-Key` header on specific endpoints:

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

### 2. Lock, Fingerprint & Replay Mechanics
1. **Header Inspection**: Evaluates `Idempotency-Key` or `X-Idempotency-Key`.
2. **Atomic Distributed Locking**: Acquires a Redis lock using `SET NX EX` for 30 seconds. Concurrent requests with the identical key receive HTTP `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
3. **Payload Fingerprint (SHA-256)**: Hashes `user_id + method + path + body`. Submitting an existing key with altered parameters returns `422 Unprocessable Entity` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
4. **Instant Replay**: Cached status codes, headers, and bodies are replayed directly without invoking handler logic, accompanied by `Idempotent-Replayed: true`.
5. **Auto Unlock on 5xx**: Server errors (HTTP 500+) safely release the lock so clients can retry.

---

## 🚦 Dual-Tier Rate Limiting & DoS Protection

`template-fastapi-async` integrates `RateLimiterMiddleware` in `middleware/rate_limiter.py`:

### 1. Protection Tiers: Global API vs Strict Auth

1. **Global Rate Limiter**:
   - Limits general request volume with `RATE_LIMIT_MAX` (default: 100 req / 60 seconds per IP).
   - Mounted globally in `app.py`: `app.add_middleware(RateLimiterMiddleware)`.
   - Whitelists health probes (`/health`, `/`) and documentation (`/docs`, `/redoc`, `/openapi.json`).
2. **Strict Auth Limiter**:
   - Protects authentication routes (`/auth/login`, `/auth/register`) against brute force.
   - Enforces strict quota `RATE_LIMIT_AUTH_MAX` (default: 5 req / 60 seconds).
   - Composite key generator: `rl:auth:{client_ip}:{path}`.

### 2. RFC 6585 Standard Headers & Hybrid Storage

- **RFC 6585 Headers**: Emits `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` (on HTTP 429).
- **Response Format**: Returns HTTP `429 Too Many Requests` envelope `error_response(message, code=RATE_LIMIT_EXCEEDED)`.
- **Hybrid Storage**: Uses Redis pipeline operations (`INCR` + `EXPIRE`) when `RATE_LIMIT_STORAGE=redis`, automatically falling back to an asyncio-locked in-memory store if Redis is unavailable.

---

## 🧵 Request Context, Tracing & Correlation ID

`template-fastapi-async` manages asynchronous request context propagation using Python's modern `contextvars` primitives without polluting global state.

### 1. X-Request-ID & Context Propagation

- **ID Extraction & Generation**: The `LogContextMiddleware` (`middleware/log_context.py`) extracts incoming `X-Request-ID` headers or generates a unique hex identifier via `uuid.uuid4().hex`.
- **Response Header Injection**: The `request_id` is stamped onto outgoing response headers via `response.headers["X-Request-ID"] = request_id`.
- **Python Context Variables (`contextvars`)**: Backed by `ContextVar[str]` in `lib/logger.py` (`request_id_var` and `user_id_var`). The context is natively scoped to the active `asyncio` coroutine and propagates automatically across `await` points, FastAPI dependency injection trees, and background tasks.
- **Safe Lifecycle Management**: The middleware guarantees context cleanup in a `finally` block via `reset_request_context()`, preventing cross-request context leakage across event loop cycles.

### 2. Structured Logging & OpenTelemetry Integration

- **Automatic Log Injection via `ContextFilter`**: `ContextFilter` in `lib/logger.py` extracts `request_id` and `user_id` from context variables and injects them into every standard Python `LogRecord`, ensuring single-line structured JSON logs always carry correlation IDs.
- **OpenTelemetry Span Extraction**: When OpenTelemetry is enabled (`trace = opentelemetry.trace`), `ContextFilter` queries the current active span (`trace.get_current_span()`) and records formatted `trace_id` and `span_id` onto each log entry.
- **Structured JSON Access Logging**: Every completed HTTP request logs structured JSON data detailing `method`, `path`, `status_code`, `duration_ms`, `client_ip`, and `user_agent`.

---

## 📋 Request Validation & Boundaries

Pydantic v2 schemas enforce structural validation before request execution:

```python title="modules/users/schemas.py"
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=2, max_length=100)
    role: str = Field(default="user")
```

---

## ⚙️ Environment Variables & Configuration

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

## 🛠️ Development Commands

```bash title="Terminal"
cd template-fastapi-async

# Create virtualenv & activate
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Alembic database migrations
alembic upgrade head

# Start local development server
uvicorn main:app --reload --port 8000

# Run pytest suite
pytest
```
