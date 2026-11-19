---
title: Express.js (TypeScript) Backend
description: Clean Architecture, Zod validation, Winston structured logging, SSE, WebSocket, Distributed Bridge, dan OpenAPI di template-express
---

Template `template-express` adalah starter kit REST API enterprise berbasis **Node.js**, **Express.js**, dan **TypeScript**, dibangun dengan prinsip Clean Architecture, keandalan message broker, dan sistem realtime terdistribusi berkinerja tinggi.

---

## ✨ Fitur Arsitektur Utama

- **Clean Architecture**: Pemisahan tegas antara layer HTTP routing (`controllers/` & `routes/`), orchestrator bisnis (`services/`), dan persistensi data (`repositories/`).
- **Validation Boundary (Zod)**: Setiap request body, URL parameters, dan query parameters divalidasi ketat pada gateway middleware sebelum mencapai controller.
- **Structured JSON Logging**: Menggunakan logger terpusat berbasis Winston (`logger.ts`) yang menghasilkan output JSON dengan level `info`, `warn`, `error`, dan `debug` (dilarang keras menggunakan `console.log`).
- **Autentikasi JWT Modern & Rotation**:
  - Access Token berumur pendek (15 menit).
  - Refresh Token Rotation dengan hashing SHA-256 di database dan cookie HTTP-only (`SameSite=Strict`, `secure=true`).
- **Database Parity & Transaksi**: Mendukung PostgreSQL (`pg`) dan MySQL (`mysql2`) dengan transaksi murni (*pure parameter passing*) via `db.withTransaction`.
- **Realtime Engine (SSE & Socket.IO)**: Dilengkapi Server-Sent Events dan WebSocket Socket.IO dengan autentikasi JWT handshake.
- **Distributed Realtime Auto-Bridge**: Bridge otomatis horizontal lintas instance melalui Redis Pub/Sub atau RabbitMQ topic exchange (`realtime`).
- **Dual Message Broker**: Terintegrasi langsung dengan RabbitMQ AMQP 0.9.1 dan Apache KafkaJS.
- **OpenAPI 3.0 Documentation**: Dokumentasi interaktif Swagger UI otomatis di `http://localhost:5000/docs` dan skema mentah di `/docs/openapi.json`.

---

## ⚡ Transaksi Database (Pure Parameter Passing `withTransaction`)

Sesuai aturan arsitektur monorepo (`database-transactions.md`), operasi mutasi multi-tabel wajib berada dalam transaksi database. `Database.getInstance().withTransaction` mengontrol lifecycle koneksi pool client, query `BEGIN`, `COMMIT`, dan auto-`ROLLBACK` jika terjadi exception:

```typescript title="src/modules/users/service.ts"
import { Database } from '../../config/database'
import { userRepository } from './repository'
import { passwordService } from '../../pkg/auth/password'
import { EmailAlreadyExistsError, ValidationError } from '../../pkg/errors'
import type { CreateUserDTO, User } from './types'

export class UserService {
  /**
   * Create a new user (dalam atomic database transaction)
   */
  async createUser (data: CreateUserDTO): Promise<User> {
    const { name, email, password } = data

    if (!name || !email) {
      throw new ValidationError('Name and email are required', { fields: ['name', 'email'] })
    }

    const db = Database.getInstance()
    return await db.withTransaction(async (client) => {
      // 1. Validasi keberadaan user menggunakan connection client transaksi
      const existingUser = await userRepository.findByEmail(email, client)
      if (existingUser) {
        throw new EmailAlreadyExistsError('Email already exists', { field: 'email' })
      }

      let hashedPassword: string | undefined
      if (password) {
        hashedPassword = await passwordService.hash(password)
      }

      // 2. Oper client transaksi ke operasi penulisan repository
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

Pada layer repository, query dieksekusi langsung pada objek `client: PoolClient`:

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

## 📡 Real-time Engine: SSE, WebSocket & Distributed Auto-Bridge

`template-express` menyediakan solusi realtime komprehensif yang mendukung dua protokol populer: **Server-Sent Events (SSE)** untuk unidirectional stream dan **WebSocket (Socket.IO)** untuk komunikasi bidirectional berlatensi rendah.

```mermaid
flowchart TD
    ClientSSE["SSE Client (EventSource)"] -->|GET /api/v1/sse/stream| Server1["Express Instance 1"]
    ClientWS["WebSocket Client (Socket.IO)"] -->|ws:// /socket.io| Server2["Express Instance 2"]
    
    API["REST API Trigger\n/api/v1/realtime/notify/:id"] --> Server1
    Server1 -->|Publish Event| Bridge{"Distributed Bridge\n(REALTIME_BRIDGE)"}
    Bridge -->|Redis Pub/Sub\natau RabbitMQ Topic| Server1
    Bridge -->|Redis Pub/Sub\natau RabbitMQ Topic| Server2
    
    Server1 -->|Push local| ClientSSE
    Server2 -->|Push local| ClientWS
```

### 1. Server-Sent Events (SSE)
SSE dikelola oleh `SSEService.getInstance()`. Koneksi dijaga tetap terbuka dengan header HTTP khusus (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).

```typescript title="Contoh Client SSE (JavaScript / React)"
const eventSource = new EventSource('/api/v1/sse/stream', { withCredentials: true });

eventSource.onopen = () => console.log('SSE Connected');
eventSource.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  console.log('General Event:', payload);
};
eventSource.addEventListener('test', (event) => {
  const payload = JSON.parse(event.data);
  console.log('Custom Event [test]:', payload);
});
eventSource.onerror = (err) => {
  console.error('SSE Error:', err);
  eventSource.close();
};
```

### 2. WebSocket Service (Socket.IO)
WebSocket berjalan di atas Socket.IO (`WebSocketService.getInstance()`) dan diproteksi oleh middleware autentikasi JWT handshake:

```javascript title="Contoh Client Socket.IO (Frontend)"
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

### 3. Distributed Auto-Bridge (`REALTIME_BRIDGE=redis|rabbitmq`)
Agar event realtime tersampaikan ke pengguna yang terhubung di server/pod berbeda pada arsitektur multi-instance Kubernetes:
- **Redis Bridge (`REALTIME_BRIDGE=redis`)**: Menggunakan Redis Pub/Sub (`pSubscribe`) untuk pertukaran pesan instan antar-node.
- **RabbitMQ Bridge (`REALTIME_BRIDGE=rabbitmq`)**: Menggunakan topic exchange `realtime` dengan antrean eksklusif per instans dan pola routing `#`.

Konfigurasi diatur transparan melalui factory `createBridge()`:

```typescript title="src/services/realtime/index.ts"
export function createBridge (): RealtimeBridge {
  return features.realtimeBridge === 'rabbitmq'
    ? new RabbitMQBridge()
    : new RedisBridge()
}
```

### 4. Daftar Endpoint Realtime

| Method | Endpoint | Deskripsi | Autentikasi |
|---|---|---|---|
| `GET` | `/api/v1/sse/stream` | Membuka stream SSE untuk menerima notifikasi real-time | Wajib (Bearer / Cookie) |
| `GET` | `/api/v1/sse/stats` | Melihat statistik koneksi SSE aktif | Wajib |
| `POST` | `/api/v1/sse/test` | Mengirim payload uji coba ke koneksi SSE milik pengguna aktif | Wajib |
| `POST` | `/api/v1/realtime/notify/:userId` | Mengirim event ke user tertentu (via SSE + WS) | Wajib |
| `POST` | `/api/v1/realtime/broadcast` | Broadcast event ke seluruh koneksi aktif | Wajib |
| `POST` | `/api/v1/realtime/channel/:channel` | Mengirim event ke grup/channel tertentu | Wajib |
| `GET` | `/api/v1/realtime/stats` | Statistik gabungan koneksi SSE dan WebSocket | Wajib |
| `GET` | `/api/v1/realtime/online/:userId` | Memeriksa apakah user tertentu sedang online | Wajib |
| `POST` | `/api/v1/realtime/disconnect/:userId` | Memutus paksa koneksi user tertentu (Admin) | Wajib (Admin) |

```bash title="Contoh: Mengirim Realtime Notification via cURL"
curl -X POST http://localhost:5000/api/v1/realtime/notify/123 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order_completed",
    "data": {
      "orderId": "ORD-9981",
      "status": "PAID"
    }
  }'
```

---

## 🐰⚡ Dual Message Broker: RabbitMQ & Apache Kafka

`template-express` menyediakan klien siap pakai untuk orkestrasi event asynchronous tingkat enterprise:

### 1. RabbitMQ Client (`src/config/rabbitmq.ts`)
Menggunakan driver resmi `amqplib` dengan fitur *automatic reconnection*, channel pooling, dan konfirmasi pesan:

```typescript
import RabbitMQClient from '../config/rabbitmq'

const rabbit = RabbitMQClient.getInstance()
await rabbit.publishMessage('orders_queue', {
  orderId: 'ORD-1234',
  amount: 250000,
  timestamp: new Date().toISOString()
})
```

### 2. Apache Kafka Producer (`src/config/kafka.ts`)
Menggunakan **KafkaJS** untuk publishing event stream bervolume tinggi:

```typescript
import KafkaClient from '../config/kafka'

const kafka = KafkaClient.getInstance()
await kafka.publish('orders-events', [
  {
    key: 'ORD-1234',
    value: JSON.stringify({ event: 'ORDER_CREATED', amount: 250000 })
  }
])
```

---

## 🛡️ Idempotency & Zod Validation Boundary

Untuk melindungi endpoint kritis (misal: pembayaran atau mutasi stok) dari duplikasi request akibat network retry, middleware idempotency memeriksa header `X-Idempotency-Key` di cache Redis. Jika request dengan key yang sama sedang diproses atau sudah selesai, server akan menolak atau mengembalikan response yang di-cache.

Validasi Zod memastikan semua request payload terdefinisi dengan skema kuat:

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

## ⚙️ Variabel Lingkungan (`.env`)

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
REALTIME_BRIDGE=redis  # Opsi: redis | rabbitmq

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

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-express

# Install seluruh dependensi
npm install

# Jalankan migrasi database
npm run migrate:up

# Jalankan server dalam mode development (dengan nodemon / tsx)
npm run dev

# Jalankan type checking
npm run type-check

# Jalankan test suite Jest
npm test

# Build untuk produksi
npm run build
npm start
```
