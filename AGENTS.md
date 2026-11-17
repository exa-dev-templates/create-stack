# AGENTS.md — Global Monorepo Guidelines for AI Coding Agents

Dokumen ini dibaca otomatis oleh Antigravity, Claude Code, Cursor, opencode, dan AI assistant lainnya saat membuka repositori root `templates`.

Repositori ini adalah kumpulan template arsitektur standar untuk backend (Express, FastAPI, Go Fiber, Spring Boot, Rust Axum), frontend (React, Vue), dan worker services (Go, Java, Python, TypeScript, Rust).

---

## 1. Aturan Global (Wajib Dipatuhi Tanpa Pengecualian)

### A. Backend Logging Terpusat (Rules: `.agents/rules/logging.md`)
- **WAJIB** menggunakan modul logging yang telah disediakan template masing-masing (`logger.ts` di Express, `logger.py` di FastAPI, `pkg/logging` di Go, `@Slf4j` di Java, `pkg/logging` via `tracing` di Rust).
- ❌ **DILARANG KERAS** menggunakan raw print: `console.log`, `print()`, `fmt.Println`, `System.out.println`, atau `println!`/`eprintln!`.
- Semua log harus terstruktur (JSON), menyertakan konteks (`requestId`, metadata), serta level yang tepat (`DEBUG`, `INFO`, `WARN`, `ERROR`).
- Jangan pernah me-log data rahasia/kredensial (password, JWT token, PIN, kartu kredit).

### B. Standardisasi Error Handling & Semantic Codes (Rules: `.agents/rules/error-handling.md`)
- Semua backend return error harus menyertakan kode semantik eksplisit dari konstanta (contoh: `USER_NOT_FOUND`, `INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`).
- Pesan error default di backend **WAJIB** berbahasa Inggris. Lokalisasi bahasa (i18n) ditangani oleh client-side.

### C. Database Transactions (Rules: `.agents/rules/database-transactions.md`)
- Operasi mutasi database wajib berada dalam transaksi.
- Pada Go: Wajib *pure parameter passing* (`tx *sqlx.Tx`). Dilarang menyimpan atau mengambil transaksi dari `context.Context`.
- Pada Rust: Wajib *pure parameter passing* (`&mut sqlx::Transaction<'_, sqlx::Postgres>` atau `&mut sqlx::Transaction<'_, sqlx::MySql>`). Dilarang menyembunyikan transaksi dalam task-local context.
- Pada Java: Wajib `@Transactional` untuk operasi mutasi dan `@Transactional(readOnly = true)` untuk operasi pembacaan.

### D. Frontend Loading State & Skeleton (Rules: `.agents/rules/frontend-loading.md` | Skill: `frontend-loading-skeleton`)
- **WAJIB SKELETON**: Setiap pemuatan data asinkron (fetch API, list, tabel `DataTable`, card grid, detail profil) wajib menampilkan **Skeleton loader**.
- ❌ **DILARANG LOADING MUTER**: Dilarang menggunakan circular spinner / spinner berputar untuk memuat konten halaman, tabel, atau list.
- ✅ **KECUALI BUTTON**: Spinner berputar HANYA diizinkan pada komponen **Button** saat tombol aksi (Submit, Simpan, Hapus) sedang memproses request.

### E. Keamanan Dependensi & Larangan Paket Rentan (Rules: `.agents/rules/package-security.md`)
- ❌ **DILARANG KERAS** menambahkan/menginstal package atau dependensi yang memiliki celah keamanan (*Known Vulnerabilities / CVE* tingkat High atau Critical), berstatus *deprecated*, atau *unmaintained*.
- **WAJIB AUDIT KEAMANAN**: Setiap penambahan paket baru wajib diverifikasi keamanannya (`npm audit`, `pip-audit`, `go mod verify`, `cargo verify-project`) dan memastikan preflight check (`npm run predev` / `make preflight`) tetap lolos 100%.
- Jika dependensi pihak ketiga menarik transitive vulnerability, wajib gunakan fitur override (`overrides` di `package.json`, `replace` di `go.mod`, `[patch]` di `Cargo.toml`).

---

## 2. Struktur Template & Lokasi Modul

- `template-express/`: Express REST API (TypeScript, Clean Architecture, Zod, Winston)
- `template-fastapi-async/`: FastAPI Async (Python 3.10+, SQLAlchemy, Pydantic, JSON Logging)
- `template-golang/`: Go Fiber (Clean Architecture, sqlx, slog)
- `template-java/`: Spring Boot 4 / Java 17 (REST, Liquibase, SLF4J/Logback)
- `template-rust/`: Rust Axum (Clean Architecture, SQLx, Tracing, JWT)
- `template-react/`: React 19 + Vite (Tailwind CSS v4, PrimeReact Aura, Zustand)
- `template-vue/`: Vue 3 + Vite (Tailwind CSS v4, PrimeVue Aura, Pinia)
- `template-worker-*/`: Dedicated background worker services (Go, Java, Python, TypeScript, Rust)

Setiap subfolder template memiliki file `AGENTS.md` dan `.agents/skills/` mandiri saat dibuka sebagai workspace tersendiri.

