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

## ⚡ Contoh Implementasi Transaction

Transaksi database dijalankan dengan pola eksplisit passing database client:

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
