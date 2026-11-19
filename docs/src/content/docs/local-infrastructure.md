---
title: Infrastruktur Docker Lokal
description: Mengelola database, caching, message broker, dan mailpit dengan docker-compose
---

Proyek yang di-generate via `@exa31/create-stack` dilengkapi file `docker-compose.infra.yml` untuk mengorkestrasi seluruh dependensi pihak ketiga secara lokal tanpa perlu menginstal PostgreSQL, MySQL, Redis, RabbitMQ, atau Kafka secara manual di laptop Anda.

---

## ⚡ Perintah Manajemen Infrastruktur

Di root folder proyek yang telah di-generate, tersedia skrip npm berikut:

```bash title="Terminal"
# Menjalankan seluruh kontainer pendukung di latar belakang
npm run infra:up

# Memantau log real-time dari seluruh kontainer
npm run infra:logs

# Menghentikan seluruh kontainer (volume data tetap aman)
npm run infra:down
```

---

## 🌐 Port & Dashboard Web UI

| Service | Port Host | Web UI Dashboard | Kredensial Default |
|---|---|---|---|
| **PostgreSQL 16** | `5432` | - | `user` / `password` (DB: `dev_db`) |
| **MySQL 8.4 LTS** | `3306` | - | `user` / `password` (Root: `rootpassword`) |
| **Redis 7 (Alpine)** | `6379` | - | *Tanpa password (dev mode)* |
| **RabbitMQ 3 (Alpine)** | `5672` (AMQP) | [http://localhost:15672](http://localhost:15672) | `guest` / `guest` |
| **Apache Kafka 3.7 (KRaft)** | `9092` (Broker) | [http://localhost:8085](http://localhost:8085) *(Kafka UI)* | *None* |
| **Mailpit** | `1025` (SMTP) | [http://localhost:8025](http://localhost:8025) *(Webmail)* | *None* |

---

## 💾 Persistensi Data

Semua data kontainer disimpan dalam Docker Named Volumes terisolasi:
- `postgres_data` (jika memilih PostgreSQL)
- `mysql_data` (jika memilih MySQL)
- `redis_data`
- `rabbitmq_data` (jika mengaktifkan RabbitMQ)
- `kafka_data` (jika mengaktifkan Kafka)

> [!TIP]
> Jika Anda ingin mereset total seluruh database lokal ke kondisi awal, jalankan:
> ```bash title="Terminal"
> docker compose -f docker-compose.infra.yml down -v
> ```
