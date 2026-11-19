---
title: Express.js (TypeScript) Backend
description: Clean Architecture, Zod validation, Winston structured logging, dan OpenAPI di template-express
---

Template `template-express` adalah starter kit REST API enterprise berbasis **Node.js**, **Express.js**, dan **TypeScript**, dibangun dengan prinsip Clean Architecture dan keamanan tingkat tinggi.

---

## ✨ Fitur Utama

- **Clean Architecture**: Pemisahan jelas antara `controllers/`, `services/`, dan `repositories/`.
- **Validation Boundary**: Validasi request body, query params, dan URL params menggunakan **Zod**.
- **Structured JSON Logging**: Menggunakan Winston logger kustom yang memformat log ke dalam JSON terstruktur (tanpa `console.log`).
- **Autentikasi JWT Modern**:
  - Access Token (umur pendek, e.g. 15 menit).
  - Refresh Token Rotation dengan penyimpanan hash di database dan cookie HTTP-only yang aman (`SameSite=Strict`).
- **Database Parity**: Mendukung PostgreSQL (`pg`) dan MySQL (`mysql2`) dengan migrasi database otomatis via `node-pg-migrate`.
- **Event Streaming & Queuing**: Publisher RabbitMQ (AMQP) dan Apache Kafka.
- **OpenAPI 3.0 Documentation**: Swagger UI interaktif di `http://localhost:5000/docs`.

---

## ⚡ Implementasi Transaksi Nyata (`withTransaction` & Pure Parameter Passing)

Template `template-express` menggunakan helper transaksi `db.withTransaction` dan `db.withReadOnlyTransaction` yang mengontrol lifecycle koneksi pool client, query `BEGIN`, `COMMIT`, dan auto-`ROLLBACK` secara aman. Objek `client: PoolClient` dioper secara eksplisit ke setiap method repository:

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

Pada layer repository, query dieksekusi langsung pada objek `client`:

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

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd backend

# Install dependencies
npm install

# Jalankan migrasi database
npm run migrate:up

# Jalankan server dalam mode development (port 5000)
npm run dev

# Jalankan test suite
npm test
```
