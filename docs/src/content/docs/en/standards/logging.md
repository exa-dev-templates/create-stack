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

---

## 🧵 Request Context & Correlation ID Propagation

Every backend service must enforce thread-safe asynchronous request context isolation:

1. **`X-Request-ID` Header**:
   - If the client transmits `X-Request-ID`, sanitize and preserve it (enforcing max length).
   - If omitted, generate a fresh UUID v4.
   - The ID **must** be echoed back via the `X-Request-ID` response header.
   - It must be attached to the `requestId` attribute in the JSON envelope (`BaseResponse`).
2. **Asynchronous Context Storage**:
   - **Express**: Node.js `AsyncLocalStorage` (`src/utils/requestContext.ts`).
   - **FastAPI**: Python `contextvars.ContextVar` (`lib/logger.py`).
   - **Go Fiber**: Go `context.Context` (`pkg/logging/fiber.go`).
   - **Java**: SLF4J `MDC` via `ThreadLocal` (`common/filter/RequestIdFilter.java`).
   - **Rust**: `tower_http::request_id` and `tracing::Span` extensions (`src/pkg/logging/middleware.rs`).
3. **Distributed Correlation & OpenTelemetry**:
   - When tracing is enabled (`OTEL_ENABLED=true`), W3C TraceContext headers (`traceparent`) propagate across HTTP calls and message queues (RabbitMQ / Kafka).
   - Structured log outputs automatically include `traceId` and `spanId`.
