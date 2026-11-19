---
title: Centralized Structured Logging (JSON)
description: Global backend structured logging rules and strict prohibition of raw print statements
---

This rule applies universally across all backend templates (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`).

---

## 🚫 Strict Prohibition: Raw Print Calls

❌ **STRICTLY FORBIDDEN** to use unformatted raw print statements anywhere in codebase:
- `console.log`, `console.warn`, `console.error` (Node.js)
- `print(...)` (Python)
- `fmt.Println`, `log.Println` (Go)
- `System.out.println`, `System.err.println` (Java)
- `println!`, `eprintln!` (Rust)

---

## ✅ Mandatory: Centralized Logger Module

All logs must pass through the pre-configured logging module:
- **Express**: `logger.ts` (Winston)
- **FastAPI**: `app/pkg/logging/logger.py`
- **Go**: `pkg/logging` (`slog`)
- **Java**: `@Slf4j` (Logback with Logstash JSON encoder)
- **Rust**: `pkg/logging` via `tracing`

---

## 📋 Structured JSON Output Specification

Every log line emitted to stdout must be single-line valid JSON containing context:

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

## 🛡️ Sensitive Data Masking
Logs **MUST NEVER** leak secret or personally identifiable credentials:
- Passwords / Password hashes
- Tokens (JWT access/refresh tokens)
- Credit card PANs / CVVs
- PINs and OTP codes
