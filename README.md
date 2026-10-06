# 🛠️ Templates Monorepo & Project Scaffolding CLI

Koleksi template starter kit untuk **Frontend**, **Backend**, dan **Worker / Background Service**, dilengkapi dengan CLI interaktif (**`create-stack`**) untuk membuat project baru dengan cepat.

---

## ⚡ Cara Cepat Menggunakan CLI

Anda bisa menjalankan CLI dari terminal mana pun:

### Opsi 1: Dari mana saja di terminal Anda (Sudah terhubung via `npm link`)
```bash
create-stack
```

### Opsi 2: Dari root direktori templates ini
```bash
npm run create
# atau
npm start
```

---

## 🚀 Fitur CLI Generator

CLI ini menyediakan 2 mode utama saat Anda ingin membuat project baru:

### 1. 🌟 Fullstack Project (Multi-service)
Menggabungkan beberapa layer ke dalam satu workspace:
- **Pilih Frontend (FE)**: React 19 (Vite) / Vue 3 (Vite) / Skip
- **Pilih Backend (BE)**: Express.js (TS) / FastAPI Async (Python) / Golang (Fiber) / Java (Spring Boot) / Skip
- **Pilih Worker (Opsional)**: Golang Worker / Java Worker / Python Worker / TypeScript Worker / Skip

**Hasil Struktur Folder:**
```text
my-awesome-app/
├── backend/          # Template BE yang dipilih
├── frontend/         # Template FE yang dipilih
├── worker/           # (Opsional) Template worker yang dipilih
├── package.json      # Root runner scripts (npm run dev:fe, dev:be)
├── .gitignore        # Root gitignore
└── README.md         # Dokumentasi petunjuk setup untuk setiap service
```

### 2. ⚡ Single Service (Standalone)
Jika Anda hanya ingin membuat 1 komponen saja (misal hanya Backend Golang, atau hanya Frontend React):
- Langsung mengekstrak template yang dipilih ke root folder project tujuan (`./my-app/`).

---

## 🧹 Apa yang Otomatis Dilakukan CLI?
1. **Pembersihan Cache & VCS**: Menghapus folder `.git`, `.agents`, `node_modules`, `dist`, `.venv`, dan target build bawaan template.
2. **Rename Konfigurasi**:
   - `package.json`: Menyesuaikan nama module (`name`) sesuai nama project.
   - `go.mod`: Mengubah nama module Go ke nama project.
   - `pom.xml`: Mengubah `artifactId` dan `name` di Maven pom.
3. **Konfigurasi Environment**: Meng-copy `.env.example` menjadi `.env` dan menyesuaikan nama default database.
4. **Git Initialization**: Menginisialisasi git repository baru (`git init`) dan membuat initial commit pertama secara otomatis.

---

## 📦 Daftar Template yang Tersedia

### 🎨 Frontend
| Template | Framework | Tech Stack & Capabilities | Port Dev |
|---|---|---|---|
| `template-react` | React 19 / Vite | SPA Client (Vite, TypeScript, Tailwind, ESLint) | 5173 |
| `template-vue` | Vue 3 / Vite | SPA Client (Vite, TypeScript, Tailwind, ESLint) | 5173 |

### ⚙️ Backend
| Template | Framework | Tech Stack & Capabilities | Port Dev |
|---|---|---|---|
| `template-express` | Express.js (Node.js) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE) | 5000 |
| `template-fastapi-async` | FastAPI (Python 3) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE) | 8000 |
| `template-golang` | Fiber v2 (Go) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS) | 8080 |
| `template-java` | Spring Boot 3 (Java) | Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE) | 8080 |

### 🔄 Worker / Queue Consumer
| Template | Framework | Tech Stack & Capabilities |
|---|---|---|
| `template-worker-golang` | Go / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-java` | Java / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-python` | Python / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
| `template-worker-typescript` | Node.js / RabbitMQ | RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown) |
