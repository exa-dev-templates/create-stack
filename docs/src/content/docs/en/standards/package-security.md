---
title: Dependency Security & 5-Pillar Audit
description: Native-first philosophy, package evaluation criteria, and vulnerability auditing
---

To safeguard against software supply chain attacks and bundle bloat, third-party dependency addition is strictly governed.

---

## 🛡️ Philosophy: Native-First & Zero-Bloat

- ❌ **Prohibited Micro-Packages**: Never install external packages for trivial logic achievable in < 30 lines of standard library code (e.g. `is-odd`, `left-pad`).
- ❌ **Prohibited Bloatware**: Avoid legacy, monolithic packages (like `moment.js` or unbundled `lodash`). Use standard browser/language runtime APIs (`Intl`, native date methods).
- ❌ **Zero CVE Tolerance**: Packages containing known High or Critical vulnerabilities are strictly rejected.

---

## 🔍 The 5-Pillar Package Evaluation Checklist

Before adding any dependency, verify:

1. **Necessity**: Can standard library APIs solve this cleanly?
2. **Bundle/Binary Footprint**: What is the impact on output size? Is it tree-shakeable?
3. **Transitive Depth**: How many sub-dependencies are pulled into the graph?
4. **Maintenance Health**: When was the last release? Is the package actively maintained?
5. **Permissive Licensing**: Is it under a permissive license (MIT, Apache 2.0, BSD)? Avoid restrictive copyleft licenses (GPL, AGPL).

---

## 🛠️ Verification & Audit Commands

New packages must pass automated security audits:
- **Node.js**: `npm audit`
- **Go**: `go mod verify`
- **Rust**: `cargo audit`
- **Python**: `pip-audit`
- **Root Monorepo**: `npm run audit:all` (via Google `osv-scanner`)
