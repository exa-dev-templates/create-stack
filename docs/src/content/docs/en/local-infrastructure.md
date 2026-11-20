---
title: Local Docker Infrastructure
description: Managing databases, caches, message brokers, and mailpit with docker-compose
---

Projects scaffolded via `@exa31/create-stack` include an automated `docker-compose.infra.yml` to orchestrate backing services locally without requiring manual database or broker installations on your host OS.

---

## ⚡ Infrastructure Control Commands

From your project root, use the following convenience scripts:

```bash title="Terminal"
# Start all backing infrastructure containers in detached mode
npm run infra:up

# Stream live container logs
npm run infra:logs

# Stop all infrastructure containers (data volumes preserved)
npm run infra:down
```

---

## 🌐 Ports & Web Dashboards

| Service | Host Port | Web Dashboard | Default Credentials |
|---|---|---|---|
| **PostgreSQL 16** | `5432` | - | `user` / `password` (DB: `dev_db`) |
| **MySQL 8.4 LTS** | `3306` | - | `user` / `password` (Root: `rootpassword`) |
| **Redis 7 (Alpine)** | `6379` | - | *No password (dev mode)* |
| **RabbitMQ 3 (Alpine)** | `5672` (AMQP) | [http://localhost:15672](http://localhost:15672) | `guest` / `guest` |
| **Apache Kafka 3.7 (KRaft)** | `9092` (Broker) | [http://localhost:8085](http://localhost:8085) *(Kafka UI)* | *None* |
| **MinIO (S3 Object Storage)** | `9000` (API) | [http://localhost:9001](http://localhost:9001) *(Console)* | `minioadmin` / `minioadminpassword` |
| **Mailpit** | `1025` (SMTP) | [http://localhost:8025](http://localhost:8025) *(Webmail)* | *None* |

---

## 💾 Data Persistence

All container state is persisted in isolated Docker Named Volumes:
- `postgres_data` (when PostgreSQL is selected)
- `mysql_data` (when MySQL is selected)
- `redis_data`
- `rabbitmq_data` (when RabbitMQ is enabled)
- `kafka_data` (when Kafka is enabled)
- `minio_data` (MinIO S3 object storage for bucket `app-uploads`)

> [!TIP]
> To perform a complete factory reset of your local database state, run:
> ```bash title="Terminal"
> docker compose -f docker-compose.infra.yml down -v
> ```
