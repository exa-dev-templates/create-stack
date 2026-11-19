---
title: Standardisasi Import & Larangan In-Function
description: Aturan top-level imports, hierarki pengelompokan modul, dan larangan wildcard
---

Kerapian dan keterbacaan import sangat krusial untuk mencegah circular dependencies dan mempermudah static analysis.

---

## 🚫 Larangan Keras

1. ❌ **In-Function Import**: Dilarang meletakkan pernyataan import di dalam tubuh fungsi/method (seperti `def func(): import x` pada Python). Semua import wajib berada di tingkat teratas modul (*module top-level*).
2. ❌ **Wildcard Import**: Dilarang menggunakan tanda bintang / wildcard (`from module import *`, `import java.util.*`). Semua simbol wajib diimpor secara eksplisit.
3. ❌ **Eksekusi Kode di Sela Import**: Dilarang menyisipkan inisialisasi variabel atau eksekusi fungsi di sela-sela blok deklarasi import.

---

## 📂 Hierarki Pengelompokan Import

Blok import wajib dikelompokkan menjadi 3 grup yang dipisahkan oleh satu baris kosong:

### Contoh (TypeScript / JavaScript):
```typescript
// 1. Standard Library / Runtime Core
import fs from 'node:fs/promises';
import path from 'node:path';

// 2. Third-Party Dependencies
import express, { Request, Response } from 'express';
import { z } from 'zod';

// 3. Internal Application Modules
import { AppError } from '@/pkg/errors';
import { userService } from '@/services/userService';
```

### Contoh (Python - PEP 8):
```python
# 1. Standard Library
import os
import sys
from typing import Optional

# 2. Third-Party Libraries
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# 3. Local Application Imports
from app.pkg.errors import AppError
from app.services.user_service import UserService
```
