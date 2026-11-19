---
title: Express.js (TypeScript) Backend
description: Clean Architecture, Zod validation, Winston structured logging, and OpenAPI in template-express
---

The `template-express` starter kit is an enterprise REST API template built with **Node.js**, **Express.js**, and **TypeScript**, engineered around Clean Architecture principles and strict security guidelines.

---

## ✨ Key Features

- **Clean Architecture**: Strict separation of concerns between `controllers/`, `services/`, and `repositories/`.
- **Validation Boundaries**: Request body, query parameters, and route parameters validated with **Zod**.
- **Structured JSON Logging**: Custom Winston logger streaming structured JSON lines with request tracing (zero `console.log`).
- **Resilient JWT Authentication**:
  - Short-lived Access Tokens (e.g. 15m).
  - Refresh Token Rotation stored as hashed digests in database with HTTP-only cookies (`SameSite=Strict`).
- **Dual Database Support**: Seamless compatibility with PostgreSQL (`pg`) and MySQL (`mysql2`) with migrations via `node-pg-migrate`.
- **Event Streaming & Queues**: Integrated producers for RabbitMQ (AMQP) and Apache Kafka.
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI served at `http://localhost:5000/docs`.

---

## ⚡ Transaction Implementation Pattern

Transactions are managed through explicit database client parameter passing:

```typescript title="src/services/userService.ts"
import { pool } from '../database';
import { userRepository } from '../repositories/userRepository';
import { AppError } from '../pkg/errors';

export class UserService {
  async registerUser(dto: CreateUserDto) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await userRepository.findByEmail(client, dto.email);
      if (existing) {
        throw new AppError('EMAIL_ALREADY_EXISTS', 'Email is already registered', 409);
      }

      const user = await userRepository.create(client, dto);
      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd backend

# Install dependencies
npm install

# Run database migrations
npm run migrate:up

# Start development server (port 5000)
npm run dev

# Run unit and integration tests
npm test
```
