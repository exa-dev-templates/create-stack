---
title: Standardisasi Error Handling & Kode Semantik
description: Format seragam BaseResponse envelope, kode semantik konstan top-level, dan panduan lokalisasi client-side
---

Untuk mencegah inkonsistensi penanganan error antara client dan server, seluruh backend (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, dan `template-rust`) menerapkan standardisasi envelope `BaseResponse` yang seragam.

---

## 📦 Standar Response Envelope (`BaseResponse`)

Seluruh respon HTTP (baik sukses 2xx maupun error 4xx / 5xx) **WAJIB** menggunakan struktur JSON datar (*flat top-level fields*). 

❌ **Dilarang Keras**: Membungkus error ke dalam objek bersarang seperti `{"error": {"code": "...", "details": [...]}}`.
✅ **Wajib**: Field `code` dan `message` berada langsung di **top-level** agar konsisten dengan contract frontend:

### 1. Error Bisnis / Domain (Contoh: 409 Conflict / 404 Not Found)

```json
{
  "success": false,
  "code": "EMAIL_ALREADY_EXISTS",
  "message": "User with this email already exists",
  "data": null,
  "timestamp": "2026-11-20T04:30:00Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 2. Error Validasi Input (Contoh: 400 Bad Request / 422 Unprocessable)

Untuk error validasi field formulir, rincian kegagalan dimasukkan ke dalam field `data`:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "data": [
    {
      "field": "email",
      "message": "Email is invalid"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ],
  "timestamp": "2026-11-20T04:30:00Z"
}
```

---

## 📋 Anatomi Field Response

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `success` | `boolean` | Ya | `true` untuk 2xx, `false` untuk 4xx / 5xx |
| `code` | `string` | Ya | Kode semantik mesin (`SCREAMING_SNAKE_CASE`) dari registry konstanta |
| `message` | `string` | Ya | Pesan deskriptif teknis default dalam **Bahasa Inggris** |
| `data` | `T \| null` | Ya | Payload data (berisi data sukses, list error validasi, atau `null`) |
| `timestamp` | `string` | Ya | Format waktu standar ISO-8601 UTC |
| `requestId` | `string` | Opsional | Unique correlation ID untuk distributed tracing (Express, Spring Boot) |

---

## 🏷️ Kode Semantik Eksplisit

Semua error domain wajib mengembalikan kode semantik bertipe huruf kapital (`SCREAMING_SNAKE_CASE`) yang bersumber dari konstanta terpusat, dilarang mengembalikan string acak:

- **Autentikasi & Akun**: `INVALID_CREDENTIALS`, `USER_NOT_FOUND`, `EMAIL_ALREADY_EXISTS`, `USERNAME_ALREADY_EXISTS`, `ACCOUNT_LOCKED`
- **Token & Sesi**: `ACCESS_TOKEN_EXPIRED`, `INVALID_ACCESS_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `TOKEN_THEFT_DETECTED`
- **Otorisasi**: `FORBIDDEN_RESOURCE`, `INSUFFICIENT_PERMISSIONS`, `ROLE_NOT_AUTHORIZED`
- **Validasi & Database**: `VALIDATION_ERROR`, `DATABASE_ERROR`, `DUPLICATE_KEY_VIOLATION`, `FOREIGN_KEY_VIOLATION`
- **Sistem**: `INTERNAL_SERVER_ERROR`, `SERVICE_UNAVAILABLE`, `RATE_LIMIT_EXCEEDED`

### Lokasi Registry Kode Semantik di Masing-Masing Backend:
- **Express**: `src/constants/codes.ts` (`RESPONSE_CODES`)
- **FastAPI**: `constants/error_codes.py`
- **Golang**: `pkg/constants/codes.go` (`Code*`)
- **Java**: `common/constant/ApiCode.java`
- **Rust**: `src/constants/codes.rs` (`CODE_*`)

---

## 🌐 Bahasa Pesan Default: Bahasa Inggris & Lokalisasi Client-Side

1. **Bahasa Inggris di Backend**:
   Semua nilai `message` yang dihasilkan backend **WAJIB berbahasa Inggris** baku (misal: `"User not found"`, `"Email already registered"`). Backend dilarang menghasilkan pesan berbahasa Indonesia langsung agar API bersifat universal.

2. **Lokalisasi (i18n) di Frontend**:
   Aplikasi Frontend (React / Vue) memanfaatkan field `code` untuk memetakan pesan ke bahasa pengguna:

```typescript title="frontend/src/utils/errorHandler.ts"
export function resolveErrorMessage(apiError: ApiErrorResponse, t: TFunction): string {
  // 1. Coba cari terjemahan berdasarkan kode semantik (misal: errors.EMAIL_ALREADY_EXISTS)
  const translationKey = `errors.${apiError.code}`
  if (i18n.exists(translationKey)) {
    return t(translationKey)
  }

  // 2. Fallback ke message Bahasa Inggris dari backend jika terjemahan belum tersedia
  return apiError.message || t('errors.GENERIC_ERROR')
}
```

---

## 💻 Definisi Envelope di Seluruh Bahasa Backend

<div class="expressive-code">
<figure class="frame not-content">
<figcaption class="header"><span>Definisi BaseResponse di 5 Bahasa</span></figcaption>

```typescript title="TypeScript (template-express)"
export type BaseResponse<T = unknown> = {
  success: boolean
  message: string
  code: ResponseCode
  data: T | null
  timestamp: string
  requestId?: string
}
```

```go title="Go (template-golang)"
type BaseResponse[T any] struct {
    Message   string `json:"message"`
    Success   bool   `json:"success"`
    Data      *T     `json:"data"`
    Code      string `json:"code"`
    Timestamp string `json:"timestamp"`
}
```

```python title="Python (template-fastapi-async)"
class BaseResponse(BaseModel, Generic[T]):
    success: bool
    message: str
    data: Optional[T] = None
    code: str
    timestamp: str
```

```java title="Java (template-java)"
public class BaseResponse<T> {
    private boolean success;
    private String code;
    private String message;
    private String requestId;
    private T data;
    private String timestamp;
}
```

```rust title="Rust (template-rust)"
pub struct BaseResponse<T> {
    pub message: String,
    pub success: bool,
    pub data: Option<T>,
    pub code: String,
    pub timestamp: String,
}
```

</figure>
</div>
