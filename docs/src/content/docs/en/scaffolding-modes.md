---
title: Scaffolding Modes
description: Understanding Mode 1 (Fullstack Multi-service) vs Mode 2 (Single Service Standalone)
---

The CLI offers two distinct generation modes when creating new projects:

---

## 🌟 Mode 1: Fullstack Project (Multi-service)

Combines multiple architectural tiers into a unified, orchestrated workspace:
- **Frontend (FE)**: React 19 (Vite) / Vue 3 (Vite) / Skip
- **Backend (BE)**: Express.js / FastAPI / Golang / Java / Rust / Skip
- **Worker (Optional)**: Golang Worker / Java Worker / Python Worker / TypeScript Worker / Rust Worker / Skip

### 📁 Generated Directory Layout
```text
my-awesome-app/
├── .agents/skills/            # Auto-merged AI agent skills from all selected services
├── backend/                   # Selected backend template
├── frontend/                  # Selected frontend template
├── worker/                    # (Optional) Selected background worker template
├── docker-compose.infra.yml   # Backing containers (DB, Redis, RabbitMQ, Kafka, Mailpit)
├── package.json               # Root orchestrator scripts (dev:fe, dev:be, dev:worker, dev:all)
├── .gitignore                 # Root gitignore
└── README.md                  # Comprehensive setup guide for the entire stack
```

### ⚡ Mode 1 Key Automation
1. **Root Runner Scripts**: Launch your entire platform concurrently using `npm run dev:all`, or target individual services using `npm run dev:fe`, `npm run dev:be`, `npm run dev:worker`.
2. **Dynamic Docker Compose**: The generated `docker-compose.infra.yml` includes only the services you selected (e.g. PostgreSQL vs MySQL, RabbitMQ vs Kafka).
3. **AI Skills Aggregation**: The CLI gathers `.agents/skills/` from each selected service and merges them into root `.agents/skills/`.

---

## ⚡ Mode 2: Single Service (Standalone)

When you only need a single isolated service (e.g. only a Golang backend, or only a React client):
- The template extracts directly into the **project root** (`./my-app/`).
- No nested `backend/` or `frontend/` folders are generated.
- Tailored for independent service repositories (*polyrepo* strategy).

### 📁 Example Layout for Single Backend:
```text
my-golang-api/
├── .agents/skills/            # AI skills tailored specifically for Go Clean Architecture
├── cmd/
│   └── api/main.go
├── internal/
│   ├── handler/
│   ├── service/
│   └── repository/
├── docker-compose.yml
├── Makefile
├── go.mod                     # Module name automatically updated to 'my-golang-api'
└── README.md
```
