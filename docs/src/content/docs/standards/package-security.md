---
title: Keamanan Dependensi & Audit 5 Pilar
description: Filosofi native-first, evaluasi dependensi, dan audit celah keamanan
---

Untuk mencegah serangan rantai pasok (*supply chain attacks*) dan pembengkakan ukuran binary (*bundle bloat*), penambahan dependensi pihak ketiga diatur secara ketat.

---

## 🛡️ Filosofi: Native-First & Zero-Bloat

- ❌ **Dilarang Micro-Packages**: Dilarang menginstal package luar untuk utilitas sepele yang dapat dibuat sendiri dengan < 30 baris kode standar bawaan runtime (hindari paket seperti `is-odd`, `left-pad`, `is-plain-obj`).
- ❌ **Dilarang Bloatware**: Dilarang menggunakan pustaka usang berbobot raksasa (seperti `moment.js` atau full `lodash`). Gunakan API native JavaScript modern (`Intl`, `Date`, native array methods).
- ❌ **Larangan Celah Keamanan (Zero CVE)**: Dilarang keras menginstal package dengan status CVE tingkat High atau Critical.

---

## 🔍 Evaluasi 5 Pilar Sebelum Instalasi

Sebelum menambahkan package baru, developer atau AI assistant wajib mengevaluasi:

1. **Necessity (Kebutuhan)**: Apakah fungsionalitas ini mutlak membutuhkan library luar atau bisa diselesaikan dengan native library bawaan bahasa?
2. **Bundle/Binary Size**: Berapa ukuran package? Apakah mendukung tree-shaking?
3. **Transitive Depth**: Berapa banyak sub-dependensi yang ditarik oleh package ini?
4. **Maintenance & Activity**: Kapan rilis terakhir? Apakah repositori aktif dimaintain atau deprecated?
5. **Permissive License**: Apakah lisensi package mengizinkan penggunaan komersial (MIT, Apache 2.0, BSD)? Hindari GPL/AGPL copyleft yang membahayakan kekayaan intelektual.

---

## 🛠️ Perintah Verifikasi Audit

Setiap penambahan package wajib lolos audit keamanan:
- **Node.js**: `npm audit`
- **Go**: `go mod verify`
- **Rust**: `cargo verify-project` / `cargo audit`
- **Python**: `pip-audit`
- **Root Monorepo**: `npm run audit:all` (menggunakan Google `osv-scanner`)
