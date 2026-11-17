---
description: Mandatory import organization and traceability standards across all ecosystems, strictly prohibiting in-function/per-function imports and enforcing official language conventions (PEP 8, ESLint, goimports, rustfmt, spotless)
trigger: glob
globs: "**/*.{py,ts,tsx,js,jsx,go,rs,java}"
---

# Import Standards & Traceability Rules (Zero-Mess & Strict Best-Practice)

Dokumen aturan ini **WAJIB DIPATUHI** oleh seluruh AI Coding Agent dan pengembang saat menulis, mengedit, atau me-refactor kode di seluruh template repositori (`template-*`).

Tujuan aturan ini adalah memastikan kode:
1. **Mudah Di-trace (*Traceable*)**: Siapa pun yang membuka file langsung mengetahui seluruh dependensi eksternal dan internal yang dibutuhkan file tersebut hanya dengan melihat bagian paling atas file (*module header*).
2. **Bebas dari Konvensi Liar (*No Improvised Hacks / Anti-Pattern*)**: Wajib mematuhi standar resmi komunitas masing-masing bahasa (PEP 8 untuk Python, ESLint/Prettier untuk TypeScript, `goimports` untuk Go, `rustfmt` untuk Rust, Google Java Style/Spotless untuk Java). Dilarang keras menciptakan gaya import sendiri (*jangan ngide*).
3. **Bebas Penalti Performa & Hidden Failures**: Menghindari *runtime lookup overhead* dan *late crashing* (error missing import yang baru meledak di tengah eksekusi fungsi setelah berjam-jam/berhari-hari di production).

---

## 1. Aturan Universal: Wajib Module Top-Level First

1. ❌ **DILARANG KERAS In-Function / Local Imports**:
   - Dilarang menempatkan deklarasi import di dalam fungsi, method, perulangan (`for`/`while`), atau blok kondisional (`if`).
   - Semua modul, class, interface, method, atau konstanta dari luar **WAJIB** diimpor di level modul paling atas file (*top-of-file*).
2. ❌ **DILARANG Menyelipkan Eksekusi Kode di Sela-Sela Import**:
   - Semua blok import harus tuntas sebelum inisialisasi variabel global modul, inisialisasi logger (`logger = ...`), konstanta, atau deklarasi class/fungsi dimulai.
3. ❌ **DILARANG Wildcard Imports**:
   - Dilarang `from foo import *`, `import foo.*`, atau `use foo::*` (kecuali `prelude::*` atau blok `#[cfg(test)]` pada Rust).
   - Selalu impor simbol secara spesifik dan eksplisit agar pembaca mengetahui asal muasal setiap fungsi/tipe yang digunakan.

---

## 2. Standar Python (PEP 8 Compliant)

Mengacu langsung pada **PEP 8 -- Style Guide for Python Code (Imports)**:

### A. Larangan In-Function Import
- ❌ **DILARANG**:
  ```python
  def calculate_hash(data: str):
      import hashlib  # ❌ SALAH: In-function import!
      return hashlib.sha256(data.encode()).hexdigest()

  def get_client(self):
      if self._client is None:
          import redis.asyncio as aioredis  # ❌ SALAH: In-function import!
          self._client = aioredis.Redis(...)
  ```
- ✅ **BENAR (Top-level)**:
  ```python
  import hashlib
  import redis.asyncio as aioredis

  def calculate_hash(data: str):
      return hashlib.sha256(data.encode()).hexdigest()

  def get_client(self):
      if self._client is None:
          self._client = aioredis.Redis(...)
  ```

### B. Pengelompokan Import PEP 8 (3 Kelompok Dipisah 1 Baris Kosong)
Urutan import wajib dibagi menjadi 3 blok yang dipisahkan tepat satu baris kosong:

```python
# 1. Standard library imports (bawaan Python)
import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Dict, List, Optional

# 2. Related third party imports (library pihak ketiga dari pip)
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

# 3. Local application/library specific imports (internal proyek)
from config.settings import settings
from constants.error_codes import USER_NOT_FOUND
from core.responses import success_response
from lib.database import get_db
from modules.users.models import User
```

### C. Penanganan Dependensi Opsional
Jika dependensi bersifat opsional (misal OpenTelemetry yang belum tentu terpasang di semua environment), tangani di **level atas modul**, bukan di dalam fungsi:

```python
# ✅ Pola Standar Python untuk Optional Dependency
try:
    from opentelemetry import trace
    HAS_OPENTELEMETRY = True
except ImportError:
    trace = None
    HAS_OPENTELEMETRY = False

def my_logger(record):
    if HAS_OPENTELEMETRY and trace:
        # Gunakan trace secara aman
        pass
```

### D. Absolute Imports vs Relative Traversal
- Wajib gunakan **Absolute Imports** berbasis root package (misal `from modules.users.models import User`).
- Hindari relative traversal liar (`from ....models import User`).

---

## 3. Standar TypeScript & JavaScript (React, Vue, Express, Worker)

### A. Larangan Inline Require & In-Function Import
- ❌ **DILARANG**:
  ```typescript
  export function processData(input: string) {
    const crypto = require('crypto') // ❌ SALAH: In-function require!
  }
  ```
- ✅ **Pengecualian Dynamic Import**:
  Dynamic `import()` HANYA diizinkan untuk keperluan *code-splitting* resmi (React lazy routes, Vue asynchronous components, dynamic plugin loading):
  ```typescript
  // ✅ Sah untuk Code-Splitting
  const UsersPage = React.lazy(() => import('@/modules/users/pages/UsersPage'))
  ```

### B. Wajib Pemisahan Tipe Eksplisit (`import type`)
Mengacu pada aturan linter `@typescript-eslint/consistent-type-imports`:
- Setiap mengimpor interface, type alias, atau generic DTO yang hanya dibutuhkan saat kompilasi, **WAJIB** menggunakan `import type`:
  ```typescript
  // ✅ BENAR
  import type { AxiosResponse } from 'axios'
  import axios from 'axios'

  import type { User, UserRole } from '@/modules/users/types'
  import { usersApi } from '@/modules/users/api'
  ```

### C. Pengurutan Terstandarisasi (`simple-import-sort`)
Urutan blok import pada TypeScript/JavaScript (secara otomatis diformat oleh `npm run lint`):
1. **Node Built-in**: `node:path`, `node:fs`, `node:url`
2. **Third-Party Libraries**: `react`, `vue`, `axios`, `primereact`, `zustand`, `pinia`
3. **Internal Absolute Path Alias (`@/*`)**: `@/api`, `@/components`, `@/modules`, `@/utils`, `@/types`
4. **Relative Imports**: `./subComponent`, `../types`
5. **Styles & Asset Side-Effects**: `./index.css`, `@primeuix/themes/aura`

```typescript
// 1. Node Built-in
import { fileURLToPath, URL } from 'node:url'

// 2. Third-Party
import type { AxiosResponse } from 'axios'
import axios from 'axios'
import { useState } from 'react'

// 3. Internal Path Alias
import type { PaginatedResponse } from '@/types'
import { getCookie, logger, setCookie } from '@/utils'

// 4. Relative
import type { User } from './types'

// 5. Styles
import '@/assets/styles/custom.css'
```

---

## 4. Standar Go (Golang)

Mengacu langsung pada pedoman resmi `goimports` dan `gofmt`:

### A. Blok Tunggal `import (...)`
- Semua import dideklarasikan dalam satu blok `import (...)` setelah deklarasi `package`.
- Blok dipisahkan menjadi 3 kelompok teratur:
  1. Standard Library Go
  2. Third-Party Libraries (misal Fiber, sqlx, pgx, zap)
  3. Internal Module Packages (`template-golang/pkg/...`, `template-golang/internal/...`)

```go
package service

import (
	// 1. Standard Library
	"context"
	"database/sql"
	"errors"
	"time"

	// 2. Third-Party Packages
	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"

	// 3. Internal Project Packages
	"template-golang/internal/models"
	"template-golang/pkg/logging"
	"template-golang/pkg/validation"
)
```

### B. Larangan Khusus
- ❌ **Dilarang Dot Import** (`import . "my/pkg"`): Mengaburkan namespace dan asal fungsi.
- ❌ **Dilarang Blank Import** (`import _ "pkg"`) kecuali untuk registrasi resmi driver database di entrypoint (misal `_ "github.com/lib/pq"` atau `_ "github.com/jackc/pgx/v5"`).

---

## 5. Standar Rust

Mengacu pada panduan resmi **Rust Standard Style Guide & `rustfmt`**:

### A. Pengelompokan `use`
Semua deklarasi `use` diletakkan di bagian atas file/modul dan diurutkan dalam 4 tingkatan:
1. `std::` / `core::` (Standard Library)
2. External Crates (`axum::`, `tokio::`, `serde::`, `sqlx::`)
3. `crate::` (Internal Crate Modules)
4. `super::` / `self::` (Modul hierarki lokal)

```rust
// 1. Standard Library
use std::sync::Arc;
use std::time::Duration;

// 2. External Crates
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

// 3. Internal Crate
use crate::error::AppError;
use crate::modules::users::models::User;
use crate::state::AppState;

// 4. Modul Lokal
use super::repository::UserRepository;
```

### B. Larangan In-Function `use`
- ❌ Dilarang meletakkan `use foo::bar;` di dalam block fungsi `fn do_something() { ... }`.
- *Pengecualian*: Hanya diperbolehkan jika terjadi bentrok nama trait (*trait collision*) yang mutlak memerlukan scope sempit.
- ❌ Dilarang wildcard `use foo::*` kecuali untuk prelude resmi (`use std::io::prelude::*`) atau modul pengetesan (`#[cfg(test)] mod tests { use super::*; }`).

---

## 6. Standar Java (Spring Boot)

Mengacu pada **Google Java Style Guide** dan konfigurasi **Spotless**:

### A. Larangan Keras Wildcard Import (`.*`)
- ❌ **DILARANG KERAS**:
  ```java
  import org.springframework.http.*; // ❌ SALAH: Wildcard import dilarang!
  import java.util.*;                // ❌ SALAH: Wildcard import dilarang!
  ```
- ✅ **BENAR (Single Type Import)**:
  ```java
  import java.util.HashMap;
  import java.util.List;
  import java.util.Map;
  import java.util.UUID;
  import org.springframework.http.HttpHeaders;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseEntity;
  ```

### B. Urutan Blok Import Java
1. Static imports (`import static org.junit.jupiter.api.Assertions.assertEquals;`)
2. Standard library Java (`import java.*`, `import javax.*`, `import jakarta.*`)
3. Third-party libraries (`import com.fasterxml.*`, `import org.springframework.*`)
4. Internal project package (`import com.example.template.*`)

---

## 7. Quality Gate & Otomasi Linter

Setiap perubahan kode harus lolos verifikasi import melalui perintah resmi template masing-masing:

- **TypeScript / React / Vue**:
  ```bash
  npm run lint       # Otomatis memperbaiki simple-import-sort & type imports
  npm run typecheck  # Memastikan tidak ada unresolved import
  ```
- **Python**:
  ```bash
  python3 -m compileall .  # Memastikan sintaks import valid
  ```
- **Go**:
  ```bash
  goimports -w . && gofmt -w .
  ```
- **Rust**:
  ```bash
  cargo fmt --check
  ```
- **Java**:
  ```bash
  ./mvnw spotless:apply
  ```
