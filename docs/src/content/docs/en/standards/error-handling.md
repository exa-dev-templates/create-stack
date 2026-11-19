---
title: Semantic Error Handling & Codes
description: Error envelope formats, explicit constant codes, and client-side localization
---

To eliminate inconsistent error handling across client and server tiers, all backend services enforce a strict error contract.

---

## 🏷️ Explicit Semantic Error Codes

Every business and domain error must return an explicit `UPPERCASE_SNAKE_CASE` constant identifier:
- `USER_NOT_FOUND`
- `INVALID_CREDENTIALS`
- `EMAIL_ALREADY_EXISTS`
- `TOKEN_EXPIRED`
- `INSUFFICIENT_PERMISSIONS`
- `INTERNAL_SERVER_ERROR`

❌ **Prohibited**: Ad-hoc, unstructured error strings like `"User not found in db"`.

---

## 🌐 Default Message Language: English

Default error messages returned by backend APIs **MUST** be written in standard technical English:
- Example: `"The requested resource could not be found."`

> **Localization (i18n)**: User-facing localization into other languages is performed by the frontend application driven by the returned semantic error `code`.

---

## 📦 Standard Error Response Envelope

All non-2xx HTTP responses follow a consistent JSON envelope structure:

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
