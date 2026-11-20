# Dual-Tier Rate Limiting Standards

Dokumen ini mendefinisikan standar rate limiting untuk seluruh backend service di dalam monorepo (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`).

---

## 1. Prinsip Utama (Dual-Tier Protection)

Setiap backend REST API wajib menerapkan sistem rate limiter dua tingkat (*dual-tier*):

1. **Tier 1: Global API Limiter**
   - Melindungi seluruh endpoint umum dari serangan DoS, scraping berlebihan, atau loop tak terbatas dari client.
   - Default: `100 request / 60 detik` per Client IP.
   - Pengecualian (*whitelist*): `/health`, `/`, `/docs`, `/swagger`, `/openapi.json`.

2. **Tier 2: Strict Auth Limiter**
   - Melindungi endpoint sensitif terhadap serangan *brute force* dan *credential stuffing* (`/auth/login`, `/auth/register`).
   - Default: `5 - 10 request / 60 detik` per IP + Email / Path.

---

## 2. Header Standar RFC 6585

Setiap respons HTTP yang melewati middleware rate limiter wajib menyertakan header standar:

| Header | Tipe Data | Deskripsi |
|---|---|---|
| `X-RateLimit-Limit` | Integer | Kuota maksimum request dalam satu jendela waktu (window) |
| `X-RateLimit-Remaining` | Integer | Sisa kuota request yang diizinkan sebelum window reset |
| `X-RateLimit-Reset` | Integer (Epoch Unix) | Waktu timestamp Unix saat kuota di-reset |
| `Retry-After` | Integer (Detik) | Jumlah detik client harus menunggu (Hanya dikirim saat HTTP 429) |

---

## 3. Format Response Error HTTP 429

Ketika client melebihi batas kuota, backend **WAJIB** mengembalikan status code `429 Too Many Requests` dengan format envelope standar `ApiResponse`:

```json
{
  "success": false,
  "message": "Too many requests. Please try again after 45 seconds.",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "data": null
}
```

---

## 4. Mekanisme Hybrid Storage (Redis + In-Memory Fallback)

1. **Mode Redis**:
   - Menghitung kuota secara terdistribusi di seluruh replika pod Kubernetes (`INCR` + `EXPIRE`).
   - Kunci: `rl:global:<ip>` atau `rl:auth:<ip>:<path>`.
2. **In-Memory Fallback**:
   - Jika koneksi Redis terputus, service **DILARANG CRASH**. Sistem wajib otomatis *failover* ke in-memory storage lokal dengan mutex/concurrency safe.
