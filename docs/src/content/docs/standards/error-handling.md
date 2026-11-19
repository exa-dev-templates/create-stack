---
title: Standardisasi Error Handling & Kode Semantik
description: Format error envelope, kode semantik konstan, dan lokalisasi client-side
---

Untuk mencegah inkonsistensi penanganan error antara client dan server, seluruh backend menerapkan standardisasi error yang ketat.

---

## 🏷️ Kode Semantik Eksplisit

Semua error bisnis wajib mengembalikan kode semantik bertipe huruf kapital (*UPPERCASE_SNAKE_CASE*) yang diambil dari konstanta:
- `USER_NOT_FOUND`
- `INVALID_CREDENTIALS`
- `EMAIL_ALREADY_EXISTS`
- `TOKEN_EXPIRED`
- `INSUFFICIENT_PERMISSIONS`
- `INTERNAL_SERVER_ERROR`

❌ **Dilarang**: Mengembalikan string error bebas seperti `"User gak ketemu"` atau `"Password salah"`.

---

## 🌐 Bahasa Pesan Default: Bahasa Inggris

Pesan error default dari backend **WAJIB** menggunakan Bahasa Inggris teknis yang baku:
- Contoh: `"The requested resource could not be found."`

> **Lokalisasi (i18n)**: Penerjemahan ke Bahasa Indonesia atau bahasa lokal pengguna ditangani di sisi client (Frontend) berdasarkan `code` semantik yang diterima.

---

## 📦 Standar Error Response Envelope

Setiap response error HTTP (status 4xx / 5xx) mengembalikan format JSON seragam:

```json
{
  "success": false,
  "message": "The email address is already in use",
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "details": [
      {
        "field": "email",
        "issue": "Must be unique"
      }
    ]
  },
  "data": null
}
```
