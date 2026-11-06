# 🛠️ Templates Monorepo & Project Scaffolding CLI

Koleksi template starter kit untuk **Frontend**, **Backend**, dan **Worker / Background Service**, dilengkapi dengan CLI interaktif (**`@exa31/create-stack`**) untuk membuat project baru dengan cepat di device mana pun.

---

## ⚡ Cara Penggunaan

### 🚀 1. Di Device Mana Saja (Instan via NPX - Rekomendasi)
Cukup buka terminal di direktori mana pun (tanpa perlu clone repo ini):

```bash
npx @exa31/create-stack
```

> **Catatan:** Package ini otomatis mengunduh template terbaru dari NPM registry dan menjalankan wizard interaktif.

---

### 💻 2. Di Komputer Lokal Ini (Development)
Jika Anda sedang mengembangkan template atau CLI di dalam repo ini:

```bash
# Jalankan generator langsung
npm run create
# atau
npm start
```

Atau jika ingin membuat command global di laptop ini:
```bash
npm run link-cli
create-stack
```

---

## 🏗️ Fitur CLI Generator

CLI menyediakan 2 mode utama pembuatan project:

### 🌟 Mode 1: Fullstack Project (Multi-service)
Menggabungkan beberapa layer arsitektur ke dalam satu workspace:
- **Frontend (FE)**: React 19 (Vite) / Vue 3 (Vite) / Skip
- **Backend (BE)**: Express.js (TS) / FastAPI Async (Python) / Golang (Fiber) / Java (Spring Boot) / Rust (Axum) / Skip
- **Worker (Opsional)**: Golang Worker / Java Worker / Python Worker / TypeScript Worker / Rust Worker / Skip

**Hasil Struktur Folder:**
```text
my-awesome-app/
├── .agents/skills/   # Otomatis merge seluruh AI Skills dari semua service yang dipilih
├── backend/          # Template BE yang dipilih
├── frontend/         # Template FE yang dipilih
├── worker/           # (Opsional) Template worker yang dipilih
├── package.json      # Root runner scripts (npm run dev:fe, dev:be, dev:worker)
├── .gitignore        # Root gitignore
└── README.md         # Petunjuk instruksi setup masing-masing service
```

### ⚡ Mode 2: Single Service (Standalone)
Jika hanya ingin membuat 1 komponen independen (misal hanya Backend Golang, atau hanya Frontend React):
- Template langsung diekstrak ke root folder project tujuan (`./my-app/`).

---

## 🤖 AI Agent Skills Ready (`.agents`)

Setiap template dilengkapi dengan instruksi dan best practice khusus AI Agent (di dalam folder `.agents/skills/`):
- **Frontend Skills**: Standar arsitektur client, routing, dan penambahan fitur frontend.
- **Backend Skills**: Standar Clean Architecture, pembuatan modul, database repository, dan use case.
- **Worker Skills**: Consumer pattern RabbitMQ, acknowledgment, dan error handling.

> Pada project Fullstack, seluruh skill dari service yang Anda pilih akan **otomatis digabung (merged)** ke dalam folder root `.agents/skills/`, sehingga AI Coding Assistant (seperti Antigravity/Cursor/Windsurf) langsung mengenali seluruh context arsitektur project.

---

## 🧹 Apa yang Otomatis Dilakukan CLI Saat Scaffolding?

1. **Pembersihan Cache & VCS**: Menghapus `.git`, `node_modules`, `dist`, `.venv`, dan build artifacts bawaan template.
2. **Preservasi `.gitignore` & `.agents`**: File konfigurasi `.gitignore` dan skill AI `.agents` dipulihkan dan disalin secara utuh.
3. **Penyesuaian Konfigurasi Nama Project**:
   - `package.json`: Menyesuaikan nama module (`name`) sesuai nama project.
   - `go.mod`: Mengubah nama module Go ke nama project.
   - `pom.xml`: Mengubah `artifactId` dan `name` di Maven pom.
4. **Environment Variables**: Meng-copy `.env.example` menjadi `.env` dan menyesuaikan nama default database.
5. **Opsi Database Utama (PostgreSQL / MySQL)**: Mendukung pemilihan database utama secara interaktif (PostgreSQL default port 5432 atau MySQL port 3306). Jika memilih MySQL, CLI secara otomatis menyesuaikan file `.env`, `docker-compose.yml` (service MySQL 8.4), driver library, dan konfigurasi database backend.
6. **Git Auto-Init**: Menginisialisasi git repository baru (`git init`) dan membuat commit pertama secara otomatis.

---

## 📦 Daftar Template yang Tersedia

### 🎨 Frontend
| Template | Framework | Tech Stack & Capabilities | Port Dev |
|---|---|---|---|
| `template-react` | React 19 / Vite | SPA Client (Vite, TypeScript, Tailwind, ESLint, Antigravity Skills) | 5173 |
| `template-vue` | Vue 3 / Vite | SPA Client (Vite, TypeScript, Tailwind, ESLint, Antigravity Skills) | 5173 |

### ⚙️ Backend
| Template | Framework | Tech Stack & Capabilities | Port Dev |
|---|---|---|---|
| `template-express` | Express.js (Node.js) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE) | 5000 |
| `template-fastapi-async` | FastAPI (Python 3) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE) | 8000 |
| `template-golang` | Fiber v2 (Go) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS) | 8080 |
| `template-java` | Spring Boot 3 (Java) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE) | 8080 |
| `template-rust` | Axum (Rust) | Clean Architecture, PostgreSQL (SQLx), JWT, Realtime (WS/SSE), Tracing | 8080 |

### 🔄 Worker / Queue Consumer
| Template | Framework | Tech Stack & Capabilities |
|---|---|---|
| `template-worker-golang` | Go / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-java` | Java / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-python` | Python / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-typescript` | Node.js / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-rust` | Rust / RabbitMQ | RabbitMQ Consumer (Lapin, Ack/Nack, QoS Prefetch, Graceful Shutdown) |

---

## 🚀 Alur Rilis Otomatis (CI/CD GitHub Actions)

Repositori ini telah dilengkapi pipeline otomasi di [`.github/workflows/publish.yml`](.github/workflows/publish.yml):

Setiap kali Anda ingin merilis versi baru ke NPM:
1. Lakukan perubahan pada template atau CLI.
2. Naikkan nomor versi di `package.json` (misal dari `1.0.1` ke `1.0.2`).
3. Commit dan push ke branch `main`:
   ```bash
   git add -A
   git commit -m "feat: deskripsi perubahan"
   git push origin main
   ```
4. **GitHub Actions otomatis**:
   - Menarik seluruh 10 submodule private template secara rekursif (`GH_PAT`).
   - Mendeteksi perbedaan versi antara repo dan NPM registry.
   - Mem-publish versi baru ke NPM secara publik tanpa memerlukan input 2FA manual (`NPM_TOKEN`).
