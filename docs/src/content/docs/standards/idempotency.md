---
title: Standar Proteksi Idempotency (X-Idempotency-Key)
description: Standar IETF draft untuk mencegah duplikasi mutasi akibat retry jaringan, payload fingerprinting SHA-256, distributed locking Redis, dan response replay di seluruh backend
---

Dalam sistem terdistribusi, kegagalan jaringan atau timeout sering kali memicu retry otomatis dari client (browser, mobile app, atau webhook gateway). Tanpa proteksi idempotency, retry pada operasi mutasi (misalnya pembayaran, pemotongan saldo, order creation, atau pemindahan dana) dapat mengakibatkan **double charge** atau data duplikat.

Seluruh 5 template backend di monorepo ini (`template-golang`, `template-express`, `template-fastapi-async`, `template-java`, dan `template-rust`) menerapkan standar idempotency yang seragam mengacu pada spesifikasi **IETF draft-ietf-httpapi-idempotency-key-header**.

---

## 🎯 Siklus Hidup Request Idempotent

```mermaid
flowchart TD
    Client["Client / Webhook"] -->|Header: Idempotency-Key: uuid| Gateway["API Gateway / Backend"]
    Gateway --> Check{"Periksa Status Key di Redis"}
    
    Check -->|Key Baru| Lock["SetNX Lock (in_progress, TTL 30s)"]
    Lock --> Handler["Eksekusi Business Logic & DB Transaction"]
    Handler --> Save["Simpan Status (completed, TTL 24h)\nHeaders + Status + Body + Fingerprint"]
    Save --> ReturnFresh["Kirim HTTP Response Asli"]
    
    Check -->|Status: in_progress| Conflict["Tolak: 409 Conflict\n(Request sedang diproses)"]
    
    Check -->|Status: completed| VerifyFingerprint{"Cek Payload Fingerprint\n(SHA-256 Path + Method + Body)"}
    VerifyFingerprint -->|Cocok| Replay["Replay Cached Response\nHeader: Idempotent-Replayed: true"]
    VerifyFingerprint -->|Beda Payload| Mismatch["Tolak: 422 Unprocessable Entity\n(Payload Mismatch)"]
```

---

## 📋 Standar Header HTTP

| Header | Tipe | Deskripsi |
|---|---|---|
| `Idempotency-Key` | Request Header | Identifier unik string (UUID v4 disarankan, 1–256 karakter) yang dihasilkan oleh client. |
| `X-Idempotency-Key` | Request Header | Fallback alternatif kompatibilitas header jika client tidak mendukung header standar. |
| `Idempotent-Replayed` | Response Header | Bernilai `true` saat response diambil dari cache replay, bukan eksekusi ulang. |
| `X-Idempotency-Replayed` | Response Header | Fallback alternatif header replay kompatibilitas. |

---

## 🛡️ 4 Mekanisme Keamanan Utama

### 1. Atomic Distributed Locking (`in_progress`)
Sebelum mengeksekusi logika bisnis atau membuka transaksi database, backend mengeksekusi operasi atomik Redis:
```text
SET idempotency:{userId}:{key} {"status":"in_progress", ...} NX EX 30
```
- Jika key sudah ada dan berstatus `in_progress`, server langsung mengembalikan status **`409 Conflict`** (`IDEMPOTENCY_CONFLICT` / `CODE_IDEMPOTENCY_IN_FLIGHT`) untuk mencegah eksekusi paralel ganda (*race condition*).
- Kunci `in_progress` memiliki TTL pendek (30 detik). Jika koneksi client terputus sebelum request selesai, lock otomatis terlepas.

### 2. Payload Fingerprinting (SHA-256)
Untuk mencegah serangan penipuan atau bug di mana client menggunakan kembali key yang sama untuk request data yang sama sekali berbeda:
- Backend menghitung hash SHA-256 dari gabungan:
  $$\text{Fingerprint} = \text{SHA256}(\text{userId} + \text{method} + \text{path} + \text{rawBody})$$
- Jika request baru membawa key yang berstatus `completed` namun payload datanya berbeda dari fingerprint awal, server menolak dengan **`422 Unprocessable Entity`** (`IDEMPOTENCY_PAYLOAD_MISMATCH`).

### 3. Automatic Response Replay
Jika request membawa key yang berstatus `completed` dan fingerprint cocok 100%:
- Server **tidak menjalankan ulang transaksi database atau logika bisnis**.
- Server langsung mengembalikan status code, headers (misal `Content-Type`), dan body JSON persis sama seperti response pertama kali.
- Server menyematkan header `Idempotent-Replayed: true`.

### 4. Kebijakan Caching Response & Automatic Unlock pada Transient Errors
Sesuai IETF draft dan best practice distributed systems, **tidak semua status HTTP boleh dicache**:

| Kategori | Status Code | Tindakan Idempotency | Alasan |
|---|---|---|---|
| **Success** | `200`, `201`, `204` | **Cache & Replay** | Transaksi selesai dengan sukses. Replay cached response untuk mencegah duplikasi. |
| **Deterministic Client Errors** | `400`, `404`, `422` | **Cache & Replay** | Error validasi/bisnis pasti gagal jika diulang dengan payload yang sama. Menghemat query DB. |
| **Server Failures** | `500`, `502`, `503`, `504` | **UNLOCK (Hapus Lock)** | Kesalahan internal server/database timeout bersifat transient; client wajib dapat mencoba kembali (*retry safely*). |
| **Rate Limiting** | `429` | **UNLOCK (Hapus Lock)** | Jika 429 dicache, transaksi akan gagal selamanya bahkan setelah jendela rate limit berlalu! |
| **Auth Expiration** | `401` | **UNLOCK (Hapus Lock)** | Token akses kadaluarsa; frontend akan me-refresh token lalu melakukan retry dengan key yang sama. |
| **Network & Concurrency** | `408`, `409`, `425` | **UNLOCK (Hapus Lock)** | Request timeout atau konflik konkurensi in-flight bersifat sementara. |

---

## 💻 Implementasi di Seluruh 5 Backend

### 1. Go (`template-golang`)
Diterapkan via middleware `idempotency.New()` pada route Fiber:

```go title="internal/app/http.go"
import "golang/pkg/idempotency"

// Pasang middleware idempotency pada rute mutasi sensitif
orders := api.Group("/orders", idempotency.New(idempotency.Config{
    Storage:     idempotency.NewRedisStorage(redisClient),
    Lifetime:    24 * time.Hour,
    LockTimeout: 30 * time.Second,
    Required:    true,
}))
orders.Post("/", orderHandler.CreateOrder)
```

### 2. Express.js (`template-express`)
Diterapkan via middleware `idempotency()` pada router Express:

```typescript title="src/modules/orders/routes.ts"
import { Router } from 'express'
import { idempotency, RedisIdempotencyStorage } from '../../middleware/idempotency'
import { orderController } from './controller'

const router = Router()

// Proteksi mutasi dengan kewajiban header Idempotency-Key
router.post(
  '/',
  idempotency({
    storage: new RedisIdempotencyStorage(),
    required: true,
    lifetimeSeconds: 86400,
    lockTimeoutSeconds: 30
  }),
  orderController.createOrder
)

export default router
```

### 3. FastAPI (`template-fastapi-async`)
Diterapkan via `IdempotencyMiddleware` global atau dependency helper `require_idempotency_key`:

```python title="main.py"
from middleware.idempotency import IdempotencyMiddleware, RedisIdempotencyStorage

# Tambahkan middleware idempotency terdistribusi ke aplikasi
app.add_middleware(
    IdempotencyMiddleware,
    storage=RedisIdempotencyStorage(),
    lifetime_seconds=86400,
    timeout_seconds=30
)
```

Untuk mewajibkan header pada endpoint tertentu:

```python title="modules/orders/routes.py"
from fastapi import APIRouter, Depends
from middleware.idempotency import require_idempotency_key

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("", dependencies=[Depends(require_idempotency_key)])
async def create_order(request: OrderCreate):
    return await order_service.create_order(request)
```

### 4. Spring Boot (`template-java`)
Diterapkan via filter servlet `IdempotencyFilter` dan anotasi kustom `@RequireIdempotencyKey`:

```java title="com/example/template/java/order/controller/OrderController.java"
@RestController
@RequestMapping("/api/orders")
public class OrderController {

  @PostMapping
  @RequireIdempotencyKey
  @Transactional
  public ResponseEntity<BaseResponse<OrderResponse>> createOrder(
      @Valid @RequestBody OrderRequest request) {
    OrderResponse response = orderService.createOrder(request);
    return ResponseEntity.ok(BaseResponse.success("Order created", response));
  }
}
```

### 5. Rust Axum (`template-rust`)
Diterapkan via middleware `idempotency_layer` dengan `IdempotencyStore`:

```rust title="src/main.rs"
use axum::{middleware, routing::post, Router};
use std::sync::Arc;
use template_rust::pkg::idempotency::{idempotency_layer, IdempotencyStore};

let idempotency_store = Arc::new(IdempotencyStore::default());

let app = Router::new()
    .route("/api/orders", post(create_order))
    .layer(middleware::from_fn(move |req, next| {
        idempotency_layer(idempotency_store.clone(), req, next)
    }));
```

---

## 🌐 Implementasi di Frontend (`template-react` & `template-vue`)

Di layer frontend, auto-inject `Idempotency-Key` secara buta (*blindly*) pada seluruh HTTP request mutasi (`POST`/`PUT`/`PATCH`) adalah **anti-pattern** karena:
1. **Kegagalan Browser Refresh:** Jika form di-refresh (F5/reload) saat transaksi in-flight atau sebelum submit, in-memory state biasa akan terhapus dan meng-generate key baru. User yang menekan tombol *Bayar* lagi setelah refresh akan memicu transaksi ganda (*double charge*).
2. **Kegagalan Timeout & Retry:** Jika request mengalami timeout jaringan (misal 15 detik), request retry **wajib membawa key yang sama persis** dengan request awal agar server dapat mengenali replay response atau status `in_progress` (409 Conflict), bukan mengeksekusi order baru.
3. **Overhead Endpoint Non-Krusial:** Endpoint mutasi ringan (seperti analytics logging, telemetry, atau auth login) tidak memerlukan overhead distributed locking di Redis.

Oleh karena itu, arsitektur frontend di monorepo ini menerapkan pendekatan **Session-Persisted, Scope-Based Idempotency**:

### 1. Zero-Bloat Key Generator & Persistence (`src/utils/idempotency.ts`)
Menggunakan Web Crypto API bawaan browser (`crypto.randomUUID()` dengan fallback cryptographically secure `crypto.getRandomValues()`), serta helper persistensi `sessionStorage` dengan TTL (30 menit):

```typescript
import { generateIdempotencyKey, getOrCreateIdempotencyKey } from '@/utils'

// Key yang bertahan walau browser di-refresh (F5) selama sesi transaksi aktif
const key = getOrCreateIdempotencyKey('checkout-form')
```

### 2. Konfigurasi Axios & In-Place Key Retention (`src/api/client.ts`)
Interceptors Axios secara cerdas menyimpan hasil generate key ke properti `config.idempotencyKey` sebagai string. Jika terjadi **timeout jaringan** atau **retry otomatis**, Axios akan menggunakan key yang **sama persis**, bukan membuat key baru:

```typescript
// Opsi A: Generate otomatis & pertahankan key jika terjadi retry / timeout
await api.post('/api/orders', orderData, { idempotencyKey: true })

// Opsi B: Gunakan key spesifik dari hook/form scope
await api.post('/api/orders', orderData, { idempotencyKey: orderKey })

// Opsi C: Menggunakan shortcut apiClient.idempotent
await apiClient.idempotent.post('/api/orders', orderData)
```

### 3. Lifecycle-Aware Hook di React (`useIdempotencyKey`)
Mendukung `scope` untuk persistensi `sessionStorage` (tahan refresh F5), serta wrapper helper `execute()` yang otomatis me-refresh key hanya saat transaksi sukses (2xx) dan mempertahankan key saat terjadi error/timeout:

```tsx
import React, { useState } from 'react'
import { apiClient } from '@/api/client'
import { useIdempotencyKey } from '@/hooks'

export const CheckoutForm: React.FC = () => {
  // Key tersimpan di sessionStorage untuk scope 'checkout-order' (aman dari refresh F5)
  const { key, execute } = useIdempotencyKey('checkout-order')
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      // execute() secara otomatis:
      // 1. Mengirim request dengan key aktif
      // 2. Jika timeout / network error: key TETAP disimpan untuk retry
      // 3. Jika sukses (2xx): key di-refresh otomatis untuk transaksi berikutnya
      await execute(async (activeKey) => {
        return await apiClient.idempotent.post('/api/orders', { amount: 150000 }, activeKey)
      })
      alert('Pesanan berhasil dibuat!')
    } catch (error) {
      // Key tetap utuh di sessionStorage, user dapat klik "Coba Lagi" tanpa khawatir double charging
      console.error('Checkout gagal:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Memproses...' : 'Bayar Sekarang'}
    </button>
  )
}
```

### 4. Lifecycle-Aware Composable di Vue (`useIdempotencyKey`)
Pola yang sama diterapkan di Vue 3 Composition API:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { useIdempotencyKey } from '@/composables'

// Scope 'checkout-order' bertahan saat browser di-refresh
const { key, execute } = useIdempotencyKey('checkout-order')
const loading = ref(false)

const handleCheckout = async () => {
  loading.value = true
  try {
    await execute(async (activeKey) => {
      return await apiClient.idempotent.post('/api/orders', { amount: 150000 }, activeKey)
    })
    alert('Pesanan berhasil dibuat!')
  } catch (error) {
    // Key tetap dipertahankan untuk retry yang aman
  } finally {
    loading.value = false
  }
}
</script>
```
