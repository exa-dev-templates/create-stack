---
description: Mandatory semantic error codes, English default messages, and frontend i18n locale synchronization
trigger: glob
globs: "**/*.{ts,go,py,java}"
---

# Error Handling & Localization Rules

All backend error returns and frontend error representations must strictly adhere to the following rules across all backend templates (Express, Go Fiber, FastAPI, Spring Boot):

---

## 1. Mandatory Semantic Error Codes on Backend Error Returns

In all backend services, the frontend error resolution pipeline maps errors directly to translation keys using `errors.${apiErr.code}`.

1. **Never return bare generic errors for specific domain conditions**:
   - ❌ **Forbidden**:
     - Returning generic `NOT_FOUND`, `BAD_REQUEST`, or `UNAUTHORIZED` for domain entities (e.g. `User not found`, `Invalid password`).
   - ✅ **Required**:
     - Always attach explicit semantic error code, e.g. `USER_NOT_FOUND`, `INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`, `REFRESH_TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, etc.

2. **Use Semantic Error Classes or Dedicated Constructors**:
   - `UserNotFoundError` (`USER_NOT_FOUND`)
   - `InvalidCredentialsError` (`INVALID_CREDENTIALS`)
   - `EmailAlreadyExistsError` (`EMAIL_ALREADY_EXISTS`)
   - `InvalidCurrentPasswordError` (`INVALID_CURRENT_PASSWORD`)
   - `InvalidRefreshTokenError` (`INVALID_REFRESH_TOKEN`)
   - `RefreshTokenExpiredError` (`REFRESH_TOKEN_EXPIRED`)
   - `AccessTokenExpiredError` (`ACCESS_TOKEN_EXPIRED`)
   - `InvalidAccessTokenError` (`INVALID_ACCESS_TOKEN`)
   - Or with generic constructors:
     - `new NotFoundError(message, RESPONSE_CODES.USER_NOT_FOUND)`
     - `new UnauthorizedError(message, RESPONSE_CODES.INVALID_CREDENTIALS)`
     - `new ConflictError(message, { field }, RESPONSE_CODES.EMAIL_ALREADY_EXISTS)`
     - `new ValidationError(message, details, RESPONSE_CODES.PASSWORD_REQUIREMENTS_NOT_MET)`

---

## 2. Default Error Messages in Backend Must Be in English

All error messages defined on the backend (the `message` field of `AppError`, database errors, validation messages, and success responses) **must be written in English by default**:

- ❌ **Forbidden**:
  - `User tidak ditemukan`
  - `Email atau password salah`
- ✅ **Required**:
  - `User not found`
  - `Invalid email or password`

Localization to other languages (such as Indonesian) is strictly handled on the client-side via the frontend translation dictionary (`frontend/src/i18n/locales/id/errors.ts`) using the semantic `code`.

---

## 3. Centralized Error Code Constants

All error codes must be declared in a centralized constant registry across all templates:
- **Express**: `src/constants/codes.ts`
- **Golang**: `internal/pkg/constants/codes.go`
- **FastAPI**: `constants/codes.py`
- **Spring Boot**: `common/constant/ResponseCode.java`

Always use `SCREAMING_SNAKE_CASE` string values.

---

## 4. Verification Checklist

Before completing any task that introduces or modifies error returns:
1. Every error return / throw in backend code uses an explicit semantic code from the constants registry.
2. All default messages on the backend are in English.
3. Backend unit tests pass and assert the semantic `code`.
