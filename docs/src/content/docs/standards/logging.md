---
title: Standar Logging Terpusat (JSON)
description: Aturan baku logging backend terstruktur dan larangan keras raw print
---

Aturan ini berlaku secara global di seluruh backend service (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`).

---

## 🚫 Larangan Keras: Raw Print

❌ **DILARANG KERAS** menggunakan perintah print mentah di lingkungan produksi:
- `console.log`, `console.warn`, `console.error` (Node.js)
- `print(...)` (Python)
- `fmt.Println`, `log.Println` (Go)
- `System.out.println`, `System.err.println` (Java)
- `println!`, `eprintln!` (Rust)

---

## ✅ Wajib: Modul Logger Terpusat

Setiap backend wajib menggunakan modul logger terstruktur yang telah disediakan:
- **Express**: `logger.ts` (Winston)
- **FastAPI**: `app/pkg/logging/logger.py`
- **Go**: `pkg/logging` (`slog`)
- **Java**: `@Slf4j` (Logback dengan JSON encoder)
- **Rust**: `pkg/logging` via `tracing`

---

## 📋 Format JSON Log Terstruktur

Setiap baris log wajib berupa JSON valid satu baris (*NDJSON*) yang menyertakan metadata:

```json
{
  "timestamp": "2026-11-19T18:00:00.000Z",
  "level": "INFO",
  "message": "User login succeeded",
  "service": "auth-service",
  "requestId": "req_88f912c4",
  "userId": "usr_99812",
  "ip": "192.168.1.10"
}
```

---

## 🛡️ Masking Data Sensitif
Log **TIDAK BOLEH** mencatat informasi rahasia pengguna:
- Password / Hash password
- Token otentikasi (JWT Bearer, Refresh Token)
- Nomor Kartu Kredit / CVV
- PIN atau kode OTP
