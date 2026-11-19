---
title: Introduction
description: Why @exa31/create-stack and this template ecosystem were built
---

## 🎯 Why @exa31/create-stack?

Bootstrapping enterprise-grade software from scratch often takes days or weeks just dealing with boilerplate:
- Configuring structured folder layouts (*Clean Architecture*).
- Setting up resilient database connection pools and strict transactional safety.
- Wiring caching layers (Redis) and distributed message brokers (RabbitMQ / Apache Kafka).
- Standardizing error envelopes, structured JSON loggers, and robust JWT auth rotations.
- Maintaining database parity between development and production.
- Training AI coding assistants (Antigravity, Claude Code, Cursor) on specific architectural conventions.

**`@exa31/create-stack`** solves this friction with an interactive, one-command CLI that scaffolds production-tested starter kits with zero security vulnerabilities.

---

## 🏗️ Monorepo Ecosystem

This repository houses 12 independent, battle-tested templates:

### 🎨 Frontend
- **React 19 (`template-react`)**: Vite, TypeScript, Tailwind CSS v4, PrimeReact (Aura theme), Zustand, React Router v6.
- **Vue 3 (`template-vue`)**: Vite, TypeScript, Tailwind CSS v4, PrimeVue (Aura theme), Pinia, Vue Router.

### ⚙️ Backend
- **Express.js (`template-express`)**: Node.js, TypeScript, Clean Architecture, Zod, Winston JSON logging, OpenAPI 3.0.
- **FastAPI Async (`template-fastapi-async`)**: Python 3.10+, asyncpg/SQLAlchemy (raw SQL queries), Pydantic v2, Alembic, OpenAPI 3.0.
- **Go Fiber (`template-golang`)**: Go 1.22+, Fiber v2, sqlx raw queries, pure parameter passing `tx *sqlx.Tx`, slog JSON logging, Swagger.
- **Spring Boot (`template-java`)**: Java 17+, Spring Boot 4, Liquibase UP/DOWN, JPA, JWT `@RequireAuth`, Swagger UI.
- **Rust Axum (`template-rust`)**: Rust 2021, Axum 0.7, SQLx compile-time query safety, `tracing` JSON logging, Argon2id, Swagger UI.

### 🔄 Worker / Queue Consumers
- **Go Worker (`template-worker-golang`)**: RabbitMQ & Kafka consumer with QoS prefetch, manual Ack/Nack, and graceful shutdown.
- **Java Worker (`template-worker-java`)**: Spring AMQP `@RabbitListener` and Kafka listener.
- **Python Worker (`template-worker-python`)**: Async consumer with Pika / aio-pika / Kafka.
- **TypeScript Worker (`template-worker-typescript`)**: Node.js worker with amqplib and auto-reconnect handling.
- **Rust Worker (`template-worker-rust`)**: Lapin AMQP and RdKafka async consumer powered by Tokio.

---

## 🤖 The AI Agent Advantage (`.agents`)

Unlike traditional scaffolding tools, `@exa31/create-stack` is built natively for **AI Coding Assistants**.

Each template contains `.agents/skills/` and instructions defined in `AGENTS.md`. When scaffolding a multi-service fullstack project, the CLI automatically **merges** all relevant skills into the root `.agents/skills/` directory, enabling Antigravity, Cursor, and Claude Code to immediately navigate the architecture with zero context hallucinations.
