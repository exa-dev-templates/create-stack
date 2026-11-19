---
description: Mandatory OpenAPI 3.0 documentation standards across all backend templates, requiring every endpoint to be documented and exposed via interactive Swagger UI
trigger: glob
globs: "**/{routes,controller,handler,main,app}.{ts,py,go,rs,java}"
---

# API Documentation Standards (Mandatory OpenAPI 3.0 & Swagger UI)

Dokumen aturan ini **WAJIB DIPATUHI** oleh seluruh AI Coding Agent dan pengembang saat menambahkan, mengubah, atau me-refactor endpoint API di seluruh template backend (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`).

Tujuan aturan ini adalah memastikan seluruh API terdokumentasi secara konsisten, interaktif, dan tidak pernah mengalami *documentation drift* (ketidaksesuaian antara kode aktual dan dokumentasi).

---

## 1. Aturan Universal: Wajib OpenAPI 3.0 & Swagger UI

1. **Wajib Tersedia di `/docs` atau `/swagger-ui.html`**:
   - Setiap service backend **WAJIB** menyajikan dokumentasi interaktif yang dapat diakses langsung via browser oleh developer dan frontend:
     - `GET /docs` (Express, FastAPI, Go Fiber, Rust Axum) atau `GET /swagger-ui.html` (Spring Boot).
     - `GET /docs/openapi.json` (Express, Go, Rust) atau `GET /v3/api-docs` (Spring Boot) atau `/openapi.json` (FastAPI).
2. ❌ **DILARANG KERAS Menambahkan Endpoint Tanpa Dokumentasi**:
   - Dilarang membuat endpoint HTTP baru (baik query `GET` maupun mutasi `POST`/`PUT`/`PATCH`/`DELETE`) tanpa mendefinisikan dokumentasi OpenAPI terkait.
   - Setiap endpoint baru **WAJIB** mencakup:
     - **Summary & Description**: Penjelasan tujuan endpoint.
     - **Tags**: Pengelompokan modul/domain (contoh: `Auth`, `Users`, `Uploads`, `Health`).
     - **Request Schema**: Format parameter query/path atau JSON body payload, tipe data, status `required`, dan contoh payload (*example values*).
     - **Security Scheme**: Jika endpoint terproteksi JWT, wajib menyertakan skema otentikasi Bearer (`security: [{ bearerAuth: [] }]`).
     - **Response Envelope Schema**: Respon sukses wajib mengikuti amplop standar `ApiResponse<T>` (`success`, `message`, `data`, `code`), serta respon error umum (`400`, `401`, `403`, `404`, `500`).

---

## 2. Panduan Implementasi Teknis per Ekosistem

### A. Express.js (`template-express`)
- Definisi OpenAPI 3.0 dikelola terpusat di `src/docs/openapi.ts`.
- Saat menambahkan router di `src/modules/<name>/routes.ts`:
  1. Daftarkan path endpoint dan method-nya ke `openapiSpecification.paths` di `src/docs/openapi.ts`.
  2. Definisikan DTO request & response schema di `components.schemas`.
  3. Antarmuka Swagger UI otomatis menyajikan rute baru di `GET /docs`.

### B. FastAPI Async (`template-fastapi-async`)
- Menggunakan kemampuan native FastAPI dan Pydantic:
  ```python
  @router.post(
      "/users",
      response_model=BaseResponse[UserResponse],
      summary="Create a new user",
      description="Registers a new user into the database.",
      tags=["Users"],
      status_code=status.HTTP_201_CREATED
  )
  async def create_user(payload: CreateUserRequest):
      ...
  ```
- FastAPI secara otomatis meregenerasi schema OpenAPI di `/docs` dan `/redoc`.

### C. Go Fiber (`template-golang`)
- Definisi OpenAPI terpusat di `internal/docs/openapi.go`.
- Saat menambahkan handler baru di `internal/modules/<domain>/handler.go`:
  1. Tambahkan deskripsi path, method, dan referensi DTO pada `internal/docs/openapi.go`.
  2. Handler Fiber pada `GET /docs` dan `GET /docs/openapi.json` akan otomatis menampilkan endpoint tersebut.

### D. Spring Boot (`template-java`)
- Menggunakan pustaka resmi Springdoc OpenAPI (`springdoc-openapi-starter-webmvc-ui`):
  ```java
  @Tag(name = "Users", description = "User management APIs")
  @RestController
  @RequestMapping("/api/users")
  public class UserController {

      @Operation(summary = "Get user by ID", description = "Returns user details based on ID")
      @ApiResponse(responseCode = "200", description = "User retrieved successfully")
      @GetMapping("/{id}")
      public ResponseEntity<BaseResponse<UserDTO>> getUserById(@PathVariable Long id) {
          ...
      }
  }
  ```
- Dokumentasi interaktif otomatis tersedia di `/swagger-ui.html` dan `/v3/api-docs`.

### E. Rust Axum (`template-rust`)
- Definisi OpenAPI terpusat di `src/modules/docs/mod.rs`.
- Saat menambahkan rute di `src/modules/<domain>/handler.rs`:
  1. Tambahkan path mapping dan schema DTO JSON di `src/modules/docs/mod.rs`.
  2. Router Axum pada `GET /docs` dan `GET /docs/openapi.json` otomatis menyajikan dokumentasi yang diperbarui.

---

## 3. Checklist Verifikasi Saat Review / Modifikasi
- [ ] Apakah endpoint baru dapat ditemukan di antarmuka Swagger UI (`/docs` atau `/swagger-ui.html`)?
- [ ] Apakah contoh request body dan response envelope sudah terdokumentasi?
- [ ] Jika endpoint membutuhkan login, apakah gembok otentikasi (`bearerAuth`) sudah disematkan?
