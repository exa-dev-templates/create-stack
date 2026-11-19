---
title: CLI Options & Prompts
description: Step-by-step walkthrough of the interactive @exa31/create-stack wizard
---

import { Badge } from '@astrojs/starlight/components';

When running `npx @exa31/create-stack`, the interactive wizard powered by `@clack/prompts` guides you through the following decisions:

---

### 1. Project Name (`projectName`)
- **Prompt**: `Project name:`
- **Validation**: Strict URL-friendly slug (lowercase alphanumeric characters and hyphens `-`). Cannot start with a period or dash.
- **Example**: `my-saas-platform`

---

### 2. Scaffolding Mode (`mode`)
- **Fullstack Project (FE + BE + Worker)**: Combines multiple services into an orchestrated multi-service workspace.
- **Single Component / Service**: Extracts one standalone service directly into the target root directory.

---

### 3. Service Selection
- **Frontend**:
  - `React 19 (Vite + Tailwind v4 + PrimeReact)`
  - `Vue 3 (Vite + Tailwind v4 + PrimeVue)`
  - `Skip Frontend`
- **Backend**:
  - `Express.js (TypeScript + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `FastAPI (Python Async + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Golang (Fiber + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Java (Spring Boot 4 + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Rust (Axum + PostgreSQL/MySQL + Redis + RabbitMQ/Kafka)`
  - `Skip Backend`
- **Worker (Optional)**:
  - `Golang Worker (RabbitMQ/Kafka Consumer)`
  - `Java Worker (Spring Boot RabbitMQ/Kafka Consumer)`
  - `Python Worker (RabbitMQ/Kafka Consumer)`
  - `TypeScript Worker (Node.js RabbitMQ/Kafka Consumer)`
  - `Rust Worker (Axum/Lapin RabbitMQ/Kafka Consumer)`
  - `Skip Worker`

---

### 4. Primary Database <Badge text="New" variant="tip" />
- **PostgreSQL (Default)**: Port `5432`.
- **MySQL 8.4**: Port `3306`.
  - *CLI Automation*: Selecting MySQL automatically tailors `.env` connection strings, backend database drivers, and the MySQL 8.4 container in `docker-compose.infra.yml`.

---

### 5. Message Broker / Event Streaming <Badge text="New" variant="tip" />
If a Backend or Worker is selected, you can specify your messaging layer:
- **🐰 + ⚡ Both (RabbitMQ + Apache Kafka)**: RabbitMQ for lightweight queues/RPC, paired with Kafka KRaft for distributed high-throughput event streaming.
- **🐰 RabbitMQ 3**: AMQP message queue with management dashboard on port `15672`.
- **⚡ Apache Kafka (KRaft)**: High-throughput event streaming with Kafka UI on port `8085`.
- **🚫 No Message Broker**: Disable messaging if your service only needs pure REST endpoints.

---

### 6. Environment & Git Initialization
- **Generate `.env`**: Clones `.env.example` into an active `.env` and tunes database names automatically.
- **Git Initialization**: Runs `git init` and makes an automated initial commit.
