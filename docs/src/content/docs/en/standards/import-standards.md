---
title: Import Standards & Top-Level Enforcement
description: Top-level module imports, grouping hierarchy, and prohibition of wildcard imports
---

Clear and deterministic module imports prevent circular dependency deadlocks and ensure fast static analysis.

---

## 🚫 Strict Prohibitions

1. ❌ **In-Function Imports**: Never place import statements inside functions or method bodies (e.g. `def func(): import x` in Python). All imports must reside at the module top-level.
2. ❌ **Wildcard Imports**: Avoid globbing or wildcard imports (`from module import *`, `import java.util.*`). Every symbol must be explicitly imported by name.
3. ❌ **Code Interleaving**: Never interleave logic, variable initialization, or function calls in between import statements.

---

## 📂 Standard Import Grouping Hierarchy

Imports must be organized into 3 sequential groups separated by single empty lines:

### Example (TypeScript / JavaScript):
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

### Example (Python - PEP 8):
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
