---
title: Mode Scaffolding
description: Perbedaan dan anatomi Mode 1 (Fullstack) dan Mode 2 (Single Service)
---

CLI menyediakan 2 mode utama saat membuat proyek baru:

---

## 🌟 Mode 1: Fullstack Project (Multi-service)

Mode ini menggabungkan beberapa layer arsitektur ke dalam satu workspace terpadu:
- **Frontend (FE)**: React 19 (Vite) / Vue 3 (Vite) / Skip
- **Backend (BE)**: Express.js / FastAPI / Golang / Java / Rust / Skip
- **Worker (Opsional)**: Golang Worker / Java Worker / Python Worker / TypeScript Worker / Rust Worker / Skip

### 📁 Struktur Folder yang Dihasilkan
```text
my-awesome-app/
├── .agents/skills/            # Otomatis merge seluruh AI Skills dari semua service yang dipilih
├── backend/                   # Template BE yang dipilih
├── frontend/                  # Template FE yang dipilih
├── worker/                    # (Opsional) Template worker yang dipilih
├── docker-compose.infra.yml   # Kontainer lokal (DB, Redis, MQ, Kafka, Mailpit)
├── package.json               # Root runner scripts (dev:fe, dev:be, dev:worker, dev:all)
├── .gitignore                 # Root gitignore
└── README.md                  # Petunjuk instruksi setup masing-masing service
```

### ⚡ Fitur Otomasi Mode Fullstack
1. **Root Runner Scripts**: Anda bisa menjalankan semua service sekaligus dengan `npm run dev:all` atau secara terpisah via `npm run dev:fe`, `npm run dev:be`, `npm run dev:worker`.
2. **Dynamic Docker Compose**: File `docker-compose.infra.yml` hanya menyertakan service kontainer yang relevan dengan pilihan Anda (misalnya PostgreSQL vs MySQL, RabbitMQ vs Kafka).
3. **AI Skills Aggregation**: CLI mengumpulkan file `.agents/skills/` dari setiap template yang dipilih dan menyatukannya ke root proyek.

---

## ⚡ Mode 2: Single Service (Standalone)

Jika Anda hanya membutuhkan 1 komponen independen (misalnya hanya ingin Backend Golang, atau hanya Frontend React):
- Template langsung diekstrak ke **root folder** proyek tujuan (`./my-app/`).
- Tidak dibuat folder pembungkus `backend/` atau `frontend/`.
- Cocok untuk arsitektur repositori terpisah (*polyrepo*).

### 📁 Contoh Struktur Single Backend:
```text
my-golang-api/
├── .agents/skills/            # AI Skills spesifik Golang Clean Architecture
├── cmd/
│   └── api/main.go
├── internal/
│   ├── handler/
│   ├── service/
│   └── repository/
├── docker-compose.yml
├── Makefile
├── go.mod                     # Otomatis diubah namanya menjadi 'my-golang-api'
└── README.md
```
