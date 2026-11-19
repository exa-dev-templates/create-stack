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

## ⚡ Database Transactions (`@transactional` & `AsyncSession`)

In `template-fastapi-async`, repository methods **do not auto-commit**, ensuring consistency across multi-table operations. Transaction boundaries are declaratively managed via `@transactional` on route handlers (or manually with `async with session.begin()`), passing `db: AsyncSession` to services and repositories:

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

@router.get("/{user_id}", response_model=BaseResponse[UserResponse])
@read_only
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves user details in a read-only transaction.
    """
    service = UserService(db)
    user = await service.get_user_by_id(user_id)
    return success_response(data=user, message="User retrieved")
```

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

## 📡 Real-time Engine: SSE, WebSocket & Redis Pub/Sub

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

eventSource.addEventListener('notification', (event) => {
  console.log('User Notification:', JSON.parse(event.data));
});

eventSource.onerror = (err) => {
  console.error('SSE Error:', err);
  eventSource.close();
};
```

### 2. WebSocket Connection Manager
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

### 3. Realtime API Endpoints

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

### 1. RabbitMQ Async Producer (`modules/rabbitmq/`)
Powered by `aio-pika` for async AMQP communication:

```python
from modules.rabbitmq.service import RabbitMQService

rabbitmq = RabbitMQService()
await rabbitmq.publish_message(
    queue_name="order_processing",
    message={"order_id": "ORD-5541", "amount": 150000}
)
```

REST endpoints for RabbitMQ:
- `POST /rabbitmq/publish`: Accepts `{ "queue_name": "tasks", "message": { ... } }`
- `GET /rabbitmq/queue-info/{queue_name}`: Inspects message backlog on a given queue

```bash title="cURL Publish to RabbitMQ"
curl -X POST http://localhost:8000/rabbitmq/publish \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "email_queue",
    "message": { "to": "user@example.com", "subject": "Welcome!" }
  }'
```

### 2. Apache Kafka Async Producer (`modules/kafka/`)
Driven by `aiokafka` for streaming records to Apache Kafka:

```python
from lib.kafka_client import kafka_client

await kafka_client.publish_message(
    topic="app.events",
    message={"event": "USER_REGISTERED", "user_id": 42},
    key="user-42"
)
```

REST endpoint for Kafka:
- `POST /kafka-send`: Dispatches a message to a topic (or defaults to `KAFKA_TOPIC`).

```bash title="cURL Publish to Apache Kafka"
curl -X POST http://localhost:8000/kafka-send \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "analytics-events",
    "key": "device-01",
    "message": { "action": "CLICK", "element": "btn-checkout" }
  }'
```

---

## ⚙️ Environment Variables (`.env`)

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
