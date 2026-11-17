---
description: Mandatory dependency security and package verification standards across all templates, strictly prohibiting the installation of vulnerable, broken, or deprecated packages
trigger: glob
globs: "**/{package.json,requirements*.txt,go.mod,Cargo.toml,pom.xml}"
---

# Package Security & Dependency Standards (Zero-Vulnerability & Zero-Bloat)

Dokumen aturan ini **WAJIB DIPATUHI** oleh semua AI Coding Agent dan pengembang saat menambahkan, memperbarui, atau mengelola dependensi/paket di seluruh template repositori (`template-*`).

Prinsip utama repositori ini adalah: **Native-First, Minimal Dependencies, Zero-Vulnerability, dan Zero-Bloat**.

---

## 1. DILARANG KERAS: Menambah Dependensi Sembarangan (*Zero-Bloat Rule*)

1. ❌ **Dilarang Menambah Library untuk Fungsi Sepele (*Native-First Rule*)**:
   - Dilarang keras menginstal library pihak ketiga untuk fungsi yang dapat diselesaikan dengan **10–20 baris kode standar bawaan bahasa (*standard library*)**.
   - Contoh: Dilarang memasang micro-packages seperti `is-odd`, `left-pad`, `is-plain-object`, `deep-equal`, dsb. Tulis fungsi helper lokal di folder `utils/` template masing-masing.
2. ❌ **Dilarang Memasang Library Raksasa / Anti-Tree-Shaking**:
   - Dilarang memasang library monolitik yang membengkakkan bundle frontend (*bundle bloat*) atau memperbesar ukuran binary/RAM backend (*runtime bloat*).
   - **Frontend Anti-Patterns**:
     - ❌ Dilarang `moment.js` (bundle besar & tidak tree-shakeable) -> Gunakan native `Intl.DateTimeFormat` atau utility ringan.
     - ❌ Dilarang full `lodash` (`import _ from 'lodash'`) -> Gunakan native JavaScript ES2020+ (`Object.assign`, `Array.prototype.flat`, `structuredClone`) atau `lodash-es` per fungsi jika mutlak diperlukan.
     - ❌ Dilarang memasang icon pack raksasa secara keseluruhan -> Hanya import icon spesifik atau SVG lokal.
3. ❌ **Dilarang Memasang Paket dengan Known Vulnerabilities (CVE)**:
   - Dilarang keras menambahkan dependensi atau versi paket yang memiliki kerentanan keamanan yang telah dipublikasikan (terutama tingkat keparahan **HIGH** atau **CRITICAL**).
4. ❌ **Dilarang Memasang Paket Usang/Deprecated/Unmaintained**:
   - Dilarang menggunakan paket atau versi library yang sudah berstatus *deprecated*, tidak menerima update keamanan > 1-2 tahun, atau memiliki pengganti resmi yang lebih modern.
5. ❌ **Dilarang Mengabaikan Audit Failures**:
   - Dilarang membiarkan `npm audit`, `pip-audit`, `osv-scanner`, `go mod verify`, atau `cargo verify-project` menghasilkan status gagal setelah dependensi ditambahkan.
   - Dilarang menggunakan flag bypass sembarangan (seperti `--force` tanpa mitigasi yang diverifikasi, atau menonaktifkan preflight checks).

---

## 2. 5-Pillar Dependency Gate (Evaluasi Sebelum Install)

Sebelum mengetik `npm install`, `go get`, `cargo add`, atau menambahkan baris di `requirements.txt` / `pom.xml`, AI Agent dan Developer **WAJIB** mengevaluasi 5 pilar berikut:

| Pilar Evaluasi | Pertanyaan Wajib | Standar Minimal yang Diterima |
| :--- | :--- | :--- |
| **1. Kebutuhan (Necessity)** | Bisakah diselesaikan dengan Standard Library bawaan? | Jika BISA diselesaikan dengan < 30 baris kode native, **JANGAN INSTALL**. |
| **2. Ukuran (Size & Bloat)** | Berapa ukuran bundle atau overhead binary/RAM yang dihasilkan? | Frontend: Max < 20-30 kB gzipped dan wajib *tree-shakeable*.<br>Backend: Hindari library yang menambah dependensi runtime berat. |
| **3. Kedalaman (Transitive Depth)** | Berapa banyak sub-dependensi (*dependencies of dependencies*) yang ditarik? | Hindari package yang menarik > 10 transitive dependencies jika fungsinya sederhana. Setiap sub-dependensi adalah potensi CVE baru. |
| **4. Keamanan & Perawatan (Maintenance)** | Kapan rilis terakhir? Apakah ada CVE terbuka? | Aktif dirawat dalam 6-12 bulan terakhir, komunitas sehat, 0 Known CVE High/Critical. |
| **5. Lisensi (License Compliance)** | Apakah lisensinya kompatibel dengan proyek komersial/terbuka? | Wajib lisensi permisif: **MIT, Apache-2.0, BSD-2/3-Clause, ISC**. Dilarang lisensi copyleft agresif (**AGPL, SSPL, GPLv3**) tanpa izin pemilik proyek. |

---

## 3. Matriks Alternatif: Hindari Bloatware -> Gunakan Native/Modern

| Ekosistem | ❌ HINDARI (Bloated / Unmaintained) | ✅ GUNAKAN (Native / Modern Standard) |
| :--- | :--- | :--- |
| **Frontend / TS** | `moment`, `moment-timezone` | Native `Intl.DateTimeFormat`, native `Date`, atau `dayjs` (modular) |
| **Frontend / TS** | `lodash` (monolitik) | Native ES6+ methods (`map`, `filter`, `reduce`, `find`, `structuredClone`) |
| **Frontend / TS** | `request`, `superagent`, `axios` (untuk fetch sederhana) | Native `fetch` bawaan browser & Node.js 18+ |
| **Frontend / TS** | `uuid` (jika hanya butuh v4 di browser modern/Node 18+) | Native `crypto.randomUUID()` |
| **Go** | Library parsing URL / query ad-hoc | Standard library `net/url`, `net/http` |
| **Go** | Library slice/map manipulation pihak ketiga | Standard library Go 1.21+ (`slices`, `maps`, `cmp`) |
| **Python** | `requests` (di async codebase) | `httpx` (async) atau standard library `urllib` |
| **Rust** | Krate macro besar untuk tugas sepele | Standard library Rust & derive macros resmi |

---

## 4. Prosedur Wajib Saat Menambahkan Dependensi Baru

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

## 5. Penanganan Transitive Vulnerabilities (Sub-dependensi)

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

## 6. Konsekuensi Pelanggaran

Repositori ini telah dilengkapi dengan **Fail-Fast Preflight** pada `npm run dev` / `make run` serta **Git Hooks** (`pre-commit` dan `pre-push`). Setiap upaya menambahkan paket yang rusak atau rentan akan:
1. Memblokir dev server lokal agar tidak dapat berjalan (`predev`).
2. Menolak commit di level git lokal (`pre-commit`).
3. Menolak push ke remote repository (`pre-push`).
