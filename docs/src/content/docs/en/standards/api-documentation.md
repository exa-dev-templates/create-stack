---
title: API Documentation & OpenAPI 3.0 Standard
description: Interactive OpenAPI 3.0 specification, Swagger UI endpoints, and schema drift prevention
---

Every backend service (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`) **MUST** serve an interactive OpenAPI 3.0 contract in strict synchronization with implementation code.

---

## 🌐 Standard Documentation Endpoints

Every backend provides two documentation formats:

1. **Interactive Swagger UI**:
   - Express, FastAPI, Go, Rust: [http://localhost:PORT/docs](http://localhost:PORT/docs)
   - Spring Boot (Java): [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
2. **Raw OpenAPI 3.0 JSON Schema**:
   - Express, FastAPI, Go, Rust: `/docs/openapi.json`
   - Spring Boot (Java): `/v3/api-docs`

---

## 🚫 Prohibition of Undocumented Endpoints

❌ **STRICTLY PROHIBITED** to expose new routes without corresponding OpenAPI metadata. Every endpoint contract must define:
- **Tags**: Domain grouping (e.g. `Auth`, `Users`, `Billing`).
- **Summary & Description**: Concise English technical summary.
- **Request Parameters & Body**: Field requirements, types, and representative JSON examples.
- **Security Requirement**: Clear declaration of Bearer JWT requirements when protected.
- **Response Schemas**: Standard `ApiResponse<T>` envelope alongside documented HTTP failure responses (400, 401, 403, 404, 409).
