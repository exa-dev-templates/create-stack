---
description: Mandatory dependency security and package verification standards across all templates, strictly prohibiting the installation of vulnerable, broken, or deprecated packages
trigger: glob
globs: "**/{package.json,requirements*.txt,go.mod,Cargo.toml,pom.xml}"
---

# Package Security & Dependency Standards

Dokumen aturan ini **WAJIB DIPATUHI** oleh semua AI Coding Agent dan pengembang saat menambahkan, memperbarui, atau mengelola dependensi/paket di seluruh template repositori (`template-*`).

---

## 1. DILARANG KERAS: Memasang Paket Rentan / Bermasalah

1. ❌ **Dilarang Menginstal Paket dengan Known Vulnerabilities (CVE)**:
   - Dilarang keras menambahkan dependensi atau versi paket yang memiliki kerentanan keamanan yang telah dipublikasikan (terutama tingkat keparahan **HIGH** atau **CRITICAL**).
2. ❌ **Dilarang Memasang Paket Usang/Deprecated**:
   - Dilarang menggunakan paket atau versi library yang sudah berstatus *deprecated*, *unmaintained*, atau memiliki pengganti resmi yang lebih aman.
3. ❌ **Dilarang Mengabaikan Audit Failures**:
   - Dilarang membiarkan `npm audit`, `pip-audit`, `osv-scanner`, `go mod verify`, atau `cargo verify-project` menghasilkan status gagal setelah dependensi ditambahkan.
   - Dilarang menggunakan flag bypass sembarangan (seperti `--force` tanpa mitigasi yang diverifikasi, atau mematikan audit).

---

## 2. Prosedur Wajib Saat Menambahkan Dependensi Baru

Setiap kali ada kebutuhan untuk menambahkan dependensi baru, AI Agent dan Developer **WAJIB** mengikuti langkah-langkah berikut:

### Langkah 1: Evaluasi Kebutuhan (Minimal Dependencies)
- Pertimbangkan apakah fungsionalitas tersebut dapat diselesaikan dengan modul standar bawaan (*standard library*) bahasa terkait tanpa menambah attack surface dependensi pihak ketiga.

### Langkah 2: Verifikasi Keamanan Sebelum dan Sesudah Instalasi
- **Node.js / TypeScript (`template-express`, `template-react`, `template-vue`, `template-worker-typescript`)**:
  ```bash
  # 1. Install package
  npm install <package-name>
  
  # 2. WAJIB: Jalankan audit keamanan
  npm audit --audit-level=high
  
  # 3. WAJIB: Jalankan preflight
  npm run preflight
  ```
  *Jika `npm audit` melaporkan kerentanan High/Critical, instalasi HARUS dibatalkan atau diperbaiki seketika.*

- **Python (`template-fastapi-async`, `template-worker-python`)**:
  ```bash
  # 1. Tambahkan dependensi ke requirements.txt dengan batasan versi aman (>=versi_aman)
  # 2. Jalankan audit
  pip-audit -r requirements.txt
  ```

- **Go (`template-golang`, `template-worker-golang`)**:
  ```bash
  # 1. Tambahkan modul
  go get <package-path>@latest
  
  # 2. Rapikan dan verifikasi checksum hash
  go mod tidy
  go mod verify
  ```

- **Rust (`template-rust`, `template-worker-rust`)**:
  ```bash
  # 1. Tambahkan ke Cargo.toml
  # 2. Verifikasi manifest & kompilasi
  cargo verify-project
  cargo check
  ```

- **Java (`template-java`, `template-worker-java`)**:
  ```bash
  # 1. Tambahkan dependensi ke pom.xml
  # 2. Verifikasi kompilasi
  ./mvnw test-compile
  ```

---

## 3. Penanganan Transitive Vulnerabilities (Sub-dependensi)

Jika paket utama yang terpercaya menarik sub-dependensi (dependensi turunan) yang memiliki celah keamanan:

1. **Pada Node.js**:
   Wajib menggunakan konfigurasi `overrides` pada `package.json` untuk memaksa versi sub-dependensi yang telah ditambal keamanannya.
   ```json
   "overrides": {
     "vulnerable-sub-package": "^safe.version"
   }
   ```
2. **Pada Go**:
   Gunakan direktif `replace` pada `go.mod` jika upstream package belum merilis versi perbaikan.
3. **Pada Rust**:
   Gunakan blok `[patch.crates-io]` di `Cargo.toml`.
4. **Pada Python**:
   Tambahkan pin sub-dependensi dengan versi aman langsung di `requirements.txt`.

---

## 4. Konsekuensi Pelanggaran

Repositori ini telah dilengkapi dengan **Fail-Fast Preflight** pada `npm run dev` / `make run` serta **Git Hooks** (`pre-commit` dan `pre-push`). Setiap upaya menambahkan paket yang rusak atau rentan akan:
1. Memblokir dev server lokal agar tidak dapat berjalan (`predev`).
2. Menolak commit di level git lokal (`pre-commit`).
3. Menolak push ke remote repository (`pre-push`).
