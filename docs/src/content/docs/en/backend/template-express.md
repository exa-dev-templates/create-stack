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

## ⚡ Real-World Transaction Pattern (`withTransaction` & Pure Parameter Passing)

The `template-express` template employs `db.withTransaction` and `db.withReadOnlyTransaction` helpers managing connection lifecycle, `BEGIN`, `COMMIT`, and auto-`ROLLBACK`. The `client: PoolClient` instance is explicitly passed to repository methods:

```typescript title="src/modules/users/service.ts"
import { Database } from '../../config/database'
import { userRepository } from './repository'
import { passwordService } from '../../pkg/auth/password'
import { EmailAlreadyExistsError, ValidationError } from '../../pkg/errors'
import type { CreateUserDTO, User } from './types'

export class UserService {
  /**
   * Create a new user (within an atomic database transaction)
   */
  async createUser (data: CreateUserDTO): Promise<User> {
    const { name, email, password } = data

    if (!name || !email) {
      throw new ValidationError('Name and email are required', { fields: ['name', 'email'] })
    }

    const db = Database.getInstance()
    return await db.withTransaction(async (client) => {
      // 1. Verify user uniqueness using the active transactional client
      const existingUser = await userRepository.findByEmail(email, client)
      if (existingUser) {
        throw new EmailAlreadyExistsError('Email already exists', { field: 'email' })
      }

      let hashedPassword: string | undefined
      if (password) {
        hashedPassword = await passwordService.hash(password)
      }

      // 2. Explicitly forward client to repository insertion
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

At the repository layer, queries execute directly on the transactional `client`:

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
