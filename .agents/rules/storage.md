# Storage Standard & Unified Object Storage Driver

Aturan ini mendefinisikan standar manajemen file dan penyimpanan objek (*object storage*) terpadu di seluruh backend template (`template-express`, `template-fastapi-async`, `template-golang`, `template-java`, `template-rust`).

---

## 1. Prinsip Utama: Unified Interface & Provider Agnostic

Setiap backend **WAJIB** mengekspos satu antarmuka abstraksi penyimpanan file seragam (`Storage` / `IStorageService` / `StorageService` / `StorageDriver`) tanpa mengunci aplikasi (*vendor lock-in*) pada satu provider spesifik.

### Provider yang Wajib Didukung:
1. **`minio`**: Driver AWS S3-compatible yang dioptimalkan untuk pengujian lokal dan on-premise private cloud via Docker Compose (`dev_minio` pada port `9000` / Console `9001`).
2. **`s3`**: Driver untuk AWS S3, Cloudflare R2, Wasabi, Google Cloud Storage (via S3 interoperability), atau DigitalOcean Spaces.
3. **`local`**: Driver filesystem lokal dengan direktori dasar (`storage/uploads` atau `/tmp/uploads`) untuk lingkungan development offline tanpa kontainer.

---

## 2. Kontrak Operasi Standar (Storage Contract)

Setiap implementasi driver wajib mengimplementasikan method-method berikut:

1. **`upload(key, content, contentType, isPublic)`**:
   - Menyimpan konten biner ke target bucket/path.
   - Mengembalikan metadata seragam: `StorageUploadResult { key, url, size, contentType }`.
2. **`download(key)`**:
   - Mengambil stream byte atau buffer konten file dari storage.
   - Wajib melempar error semantik eksplisit `FILE_NOT_FOUND` jika file tidak ditemukan.
3. **`delete(key)`**:
   - Menghapus objek dari storage secara idempoten (tidak error jika file sudah tidak ada).
4. **`getUrl(key)`**:
   - Mengembalikan URL publik permanen (misal via CDN atau base URL yang dikonfigurasi).
5. **`getPresignedUploadUrl(key, contentType, expiresInSeconds)`**:
   - Menghasilkan URL presigned aman berbatas waktu untuk upload langsung (*direct-to-S3/MinIO*) dari frontend/client tanpa membebani bandwidth backend server.
6. **`getPresignedDownloadUrl(key, expiresInSeconds)`**:
   - Menghasilkan URL presigned aman berbatas waktu untuk download file privat.
7. **`exists(key)`**:
   - Memeriksa keberadaan file secara efisien tanpa mendownload seluruh isi file.

---

## 3. Keamanan Path & Proteksi Path Traversal

Pada driver `local`, implementasi **WAJIB** memvalidasi dan meng-kanonikalisasi path (`Path.canonicalize()` / `path.resolve()` / `filepath.Clean()`) untuk mencegah serangan **Directory Traversal** (`../`). Jika target path berada di luar direktori dasar yang diizinkan, request wajib ditolak dengan HTTP `400 Bad Request` (`VALIDATION_ERROR`).

---

## 4. Konfigurasi Standar Environment

Konfigurasi driver dikendalikan melalui variabel lingkungan seragam:

```bash
STORAGE_PROVIDER=minio          # Pilihan: minio | s3 | local
STORAGE_LOCAL_PATH=storage/uploads
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=app-uploads
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadminpassword
S3_FORCE_PATH_STYLE=true        # Wajib true untuk MinIO & Local S3 emulation
S3_USE_SSL=false
STORAGE_PUBLIC_URL=http://localhost:9000/app-uploads
```

---

## 5. Pengujian dengan Testcontainers

Setiap template backend menyertakan rangkaian integration test (`storage.test`) yang memverifikasi siklus upload, presigned URL, download, dan delete menggunakan container **MinIO** nyata via Testcontainers, dengan otomatis fallback ke mock/skip jika Docker daemon tidak aktif.
