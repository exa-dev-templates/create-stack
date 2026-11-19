---
title: Express.js (TypeScript) Backend
description: Clean Architecture, Zod validation, Winston structured logging, SSE, WebSocket, Distributed Bridge, and OpenAPI in template-express
---

The `template-express` template is an enterprise-grade REST API starter kit built on **Node.js**, **Express.js**, and **TypeScript**, engineered with Clean Architecture principles, reliable message brokering, and high-performance distributed realtime systems.

---

## ✨ Core Architectural Features

- **Clean Architecture**: Strict separation between HTTP routing (`controllers/` & `routes/`), business orchestration (`services/`), and data persistence (`repositories/`).
- **Validation Boundary (Zod)**: Request bodies, URL params, and query strings are rigorously validated at gateway middleware before reaching controllers.
- **Structured JSON Logging**: Centralized Winston-based logger (`logger.ts`) producing JSON log events across `info`, `warn`, `error`, and `debug` levels (raw `console.log` is strictly prohibited).
- **Modern JWT Authentication & Rotation**:
  - Short-lived Access Tokens (15 minutes).
  - Refresh Token Rotation storing SHA-256 hashes in PostgreSQL/MySQL and transmitting secure HTTP-only cookies (`SameSite=Strict`, `secure=true`).
- **Database Parity & Transactions**: Supports PostgreSQL (`pg`) and MySQL (`mysql2`) with pure parameter-passing transactions via `db.withTransaction`.
- **Realtime Engine (SSE & Socket.IO)**: Built-in Server-Sent Events and WebSocket Socket.IO with JWT handshake authentication.
- **Distributed Realtime Auto-Bridge**: Horizontal cross-instance bridging powered by Redis Pub/Sub or RabbitMQ topic exchange (`realtime`).
- **Dual Message Brokers**: Out-of-the-box clients for RabbitMQ AMQP 0.9.1 and Apache Kafka (KafkaJS).
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI auto-served at `http://localhost:5000/docs` and raw spec at `/docs/openapi.json`.

---

## ⚡ Database Transactions (Pure Parameter Passing)

In compliance with monorepo guidelines (`database-transactions.md`), multi-step database mutations must execute inside atomic transactions. `Database.getInstance().withTransaction` manages connection client lifecycles, issuing `BEGIN`, `COMMIT`, and automatic `ROLLBACK` on unhandled exceptions:

### 1. Read-Only Operations

For data queries, client connections are managed via `withReadOnlyTransaction`:

```typescript title="src/modules/users/service.ts"
async getUserById (id: string): Promise<User> {
  const db = Database.getInstance()
  return await db.withReadOnlyTransaction(async (client) => {
    const user = await userRepository.findById(id, client)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    return user
  })
}
```

### 2. Data Mutations & Atomic Rollback

For write operations (`INSERT`, `UPDATE`, `DELETE`), business logic executes inside `withTransaction`:

```typescript title="src/modules/users/service.ts"
import { Database } from '../../config/database'
import { userRepository } from './repository'
import { passwordService } from '../../pkg/auth/password'
import { EmailAlreadyExistsError, ValidationError } from '../../pkg/errors'
import type { CreateUserDTO, User } from './types'

export class UserService {
  async createUser (data: CreateUserDTO): Promise<User> {
    const { name, email, password } = data

    if (!name || !email) {
      throw new ValidationError('Name and email are required', { fields: ['name', 'email'] })
    }

    const db = Database.getInstance()
    return await db.withTransaction(async (client) => {
      // 1. Verify user existence using the transaction connection client
      const existingUser = await userRepository.findByEmail(email, client)
      if (existingUser) {
        throw new EmailAlreadyExistsError('Email already exists', { field: 'email' })
      }

      let hashedPassword: string | undefined
      if (password) {
        hashedPassword = await passwordService.hash(password)
      }

      // 2. Pass transaction client to repository write operations
      return await userRepository.create(
        {
          name,
          email,
          password: hashedPassword,
          role: data.role
        },
        client
      )
    })
  }
}
```

### 3. Repository Layer

At the repository layer, queries are executed directly on the provided `client: PoolClient`:

```typescript title="src/modules/users/repository.ts"
import type { PoolClient } from 'pg'
import { BaseRepository } from '../../repositories/BaseRepository'
import type { CreateUserDTO, User } from './types'

class UserRepository extends BaseRepository<User> {
  async create (data: CreateUserDTO, client?: PoolClient): Promise<User> {
    const { name, email, password, role } = data
    const sql = `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *`
    const values = [name, email, password, role]

    if (client) {
      const result = await client.query(sql, values)
      return result.rows[0] as User
    }

    return await this.withTransaction(async (c) => {
      const result = await c.query(sql, values)
      return result.rows[0] as User
    })
  }
}
```

---

## 📡 Real-time Engine: SSE, WebSocket & Distributed Bridge

`template-express` provides a unified realtime architecture supporting two key transmission protocols: **Server-Sent Events (SSE)** for unidirectional event streaming and **WebSocket (Socket.IO)** for low-latency bidirectional communication.

```mermaid
flowchart TD
    ClientSSE["SSE Client (EventSource)"] -->|GET /api/v1/sse/stream| Server1["Express Instance 1"]
    ClientWS["WebSocket Client (Socket.IO)"] -->|ws:// /socket.io| Server2["Express Instance 2"]
    
    API["REST API Trigger\n/api/v1/realtime/notify/:id"] --> Server1
    Server1 -->|Publish Event| Bridge{"Distributed Bridge\n(REALTIME_BRIDGE)"}
    Bridge -->|Redis Pub/Sub\nor RabbitMQ Topic| Server1
    Bridge -->|Redis Pub/Sub\nor RabbitMQ Topic| Server2
    
    Server1 -->|Push local| ClientSSE
    Server2 -->|Push local| ClientWS
```

### 1. Server-Sent Events (SSE)
SSE is managed via `SSEService.getInstance()`. Connections remain persistent using HTTP streaming headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).

```typescript title="Client SSE Example (JavaScript / React)"
const eventSource = new EventSource('/api/v1/sse/stream', { withCredentials: true });

eventSource.onopen = () => console.log('SSE Connected');
eventSource.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  console.log('General Event:', payload);
};
eventSource.onerror = (err) => {
  console.error('SSE Error:', err);
  eventSource.close();
};
```

### 2. Full-Duplex WebSocket
WebSockets are driven by Socket.IO (`WebSocketService.getInstance()`) and safeguarded by JWT handshake middleware:

```javascript title="Client Socket.IO Example (Frontend)"
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket", "polling"],
  auth: {
    token: "Bearer <ACCESS_TOKEN>"
  }
});

socket.on("connect", () => {
  console.log("Connected with socket ID:", socket.id);
});

socket.on("notification", (data) => {
  console.log("Incoming Notification:", data);
});
```

### 3. Distributed Auto-Bridge (Horizontal Scaling)
To ensure realtime messages reach users connected across disparate pods in a Kubernetes cluster:
- **Redis Bridge (`REALTIME_BRIDGE=redis`)**: Uses Redis Pub/Sub (`pSubscribe`) for inter-instance event dissemination.
- **RabbitMQ Bridge (`REALTIME_BRIDGE=rabbitmq`)**: Utilizes topic exchange `realtime` with exclusive per-instance queues and `#` wildcards.

Configuration is seamlessly controlled via the bridge factory `createBridge()`:

```typescript title="src/services/realtime/index.ts"
export function createBridge (): RealtimeBridge {
  return features.realtimeBridge === 'rabbitmq'
    ? new RabbitMQBridge()
    : new RedisBridge()
}
```

### 4. Realtime API Endpoints

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| `GET` | `/api/v1/sse/stream` | Opens an SSE connection for real-time notification streaming | Required (Bearer / Cookie) |
| `GET` | `/api/v1/sse/stats` | Inspects active SSE connection metrics | Required |
| `POST` | `/api/v1/sse/test` | Pushes a test payload to the active user's SSE streams | Required |
| `POST` | `/api/v1/realtime/notify/:userId` | Dispatches an event to a specific user (via SSE + WS) | Required |
| `POST` | `/api/v1/realtime/broadcast` | Broadcasts an event to all actively connected sockets/streams | Required |
| `POST` | `/api/v1/realtime/channel/:channel` | Publishes an event to a specific topic room/channel | Required |
| `GET` | `/api/v1/realtime/stats` | Aggregated connection statistics across SSE and WebSocket | Required |
| `GET` | `/api/v1/realtime/online/:userId` | Checks whether a user is currently online | Required |
| `POST` | `/api/v1/realtime/disconnect/:userId` | Forcibly terminates a user's active sockets (Admin) | Required (Admin) |

---

## 🐰⚡ Dual Message Brokers: RabbitMQ & Apache Kafka

`template-express` comes equipped with production-grade clients for asynchronous event pipelines:

### 1. RabbitMQ Producer & Consumer
Built with `amqplib`, offering automatic connection recovery, channel pooling, and publisher confirms:

```typescript title="src/config/rabbitmq.ts"
import RabbitMQClient from '../config/rabbitmq'

const rabbit = RabbitMQClient.getInstance()
await rabbit.publishMessage('orders_queue', {
  orderId: 'ORD-1234',
  amount: 250000,
  timestamp: new Date().toISOString()
})
```

### 2. Apache Kafka Producer
Powered by **KafkaJS** for resilient high-throughput event streaming:

```typescript title="src/config/kafka.ts"
import KafkaClient from '../config/kafka'

const kafka = KafkaClient.getInstance()
await kafka.publish('orders-events', [
  {
    key: 'ORD-1234',
    value: JSON.stringify({ event: 'ORDER_CREATED', amount: 250000 })
  }
])
```

### 3. Broker Endpoints & Testing cURL

```bash title="Dispatch Broadcast Event via cURL"
curl -X POST http://localhost:5000/api/v1/realtime/broadcast \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "global_announcement",
    "data": { "message": "System update in 10 minutes" }
  }'
```

---

## 🛡️ Idempotency Protection (X-Idempotency-Key)

To protect mutating endpoints (e.g. payment processing, order creation, balance deductions) against duplicate processing caused by network retries, `template-express` provides production-grade idempotency middleware in `src/middleware/idempotency.ts` adhering to the IETF draft standard:

### 1. Middleware & Storage Configuration

```typescript title="src/modules/orders/routes.ts"
import { Router } from 'express'
import { idempotency, RedisIdempotencyStorage } from '../../middleware/idempotency'
import { orderController } from './controller'

const router = Router()

// Protect mutating routes with mandatory Idempotency-Key
router.post(
  '/',
  idempotency({
    storage: new RedisIdempotencyStorage(),
    required: true,               // Enforce Idempotency-Key header presence
    lifetimeSeconds: 86400,       // Cache completed responses for 24 hours
    lockTimeoutSeconds: 30        // Lock in-flight requests for 30 seconds
  }),
  orderController.createOrder
)

export default router
```

### 2. Lock, Fingerprint & Replay Mechanics
1. **Header Inspection**: Evaluates `Idempotency-Key` or `X-Idempotency-Key`.
2. **Atomic Distributed Locking**: Issues `SET idempotency:{userId}:{key} NX EX 30` in Redis. Simultaneous requests with the identical key are rejected with `409 Conflict`.
3. **Payload Fingerprinting (SHA-256)**: Computes a hash of `userId + method + path + body`. Submitting an existing key with altered data triggers `422 Unprocessable Entity` (`IdempotencyPayloadMismatchError`).
4. **Cached Response Replay**: For previously completed requests, cached status codes, headers, and JSON bodies are returned immediately with `Idempotent-Replayed: true`.
5. **Safety Unlock**: Unlocks on 5xx internal server errors, allowing clients to safely retry.

---

## 📋 Request Validation & Boundaries

Zod schemas enforce structural validity at the gateway before request bodies reach handlers:

```typescript title="src/modules/realtime/validation.ts"
import { z } from 'zod'

export const notifyUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required')
  }),
  body: z.object({
    event: z.string().min(1, 'Event name is required'),
    data: z.any()
  })
})
```

---

## ⚙️ Environment Variables & Configuration

```ini title=".env"
# Server Configuration
PORT=5000
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:3000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=template_express_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_MIN=2
DB_POOL_MAX=20

# JWT Secrets
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=super-secret-refresh-key-minimum-32-chars-long
JWT_REFRESH_EXPIRES_IN=7d

# Realtime Engine & Distributed Bridge
ENABLE_SSE=true
ENABLE_WEBSOCKET=true
REALTIME_BRIDGE=redis  # Options: redis | rabbitmq

# Redis Configuration
ENABLE_REDIS=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ Configuration
ENABLE_RABBITMQ=true
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Apache Kafka Configuration
ENABLE_KAFKA=true
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=express-backend
```

---

## 🛠️ Development Commands

```bash title="Terminal"
cd template-express

# Install dependencies
npm install

# Run database migrations
npm run migrate:up

# Start local development server (with nodemon / tsx)
npm run dev

# Run type check
npm run type-check

# Run test suite
npm test

# Build for production
npm run build
npm start
```
