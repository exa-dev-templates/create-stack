---
title: Standardisasi Dokumentasi API & OpenAPI 3.0
description: Aturan kepatuhan OpenAPI 3.0, Swagger UI, dan sinkronisasi dokumentasi
---

Setiap service backend (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`) **WAJIB** menyediakan dokumentasi API interaktif yang selalu sinkron dengan kode aktual.

---

## 🌐 Endpoint Dokumentasi Baku

Setiap backend menyajikan dua format dokumentasi:

1. **Interactive Swagger UI**:
   - Express, FastAPI, Go, Rust: [http://localhost:PORT/docs](http://localhost:PORT/docs)
   - Spring Boot (Java): [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
2. **Raw OpenAPI 3.0 JSON Schema**:
   - Express, FastAPI, Go, Rust: `/docs/openapi.json`
   - Spring Boot (Java): `/v3/api-docs`

---

## 🚫 Larangan Endpoint Tanpa Dokumentasi

❌ **DILARANG KERAS** menambahkan router atau controller baru tanpa mendaftarkannya ke dalam skema OpenAPI. Setiap endpoint wajib memiliki:
- **Tags**: Pengelompokan domain fitur (misal: `Auth`, `Users`, `Products`).
- **Summary & Description**: Penjelasan fungsi endpoint dalam Bahasa Inggris.
- **Request Body & Parameters Schema**: Tipe data field wajib, tipe data (string, uuid, integer), dan contoh payload (*example*).
- **Security Requirements**: Tanda otentikasi (Bearer Auth JWT) jika endpoint bersifat terproteksi.
- **Response Schemas**: Format sukses (`ApiResponse<T>`) dan kemungkinan kode error semantik (400, 401, 403, 404, 409).
