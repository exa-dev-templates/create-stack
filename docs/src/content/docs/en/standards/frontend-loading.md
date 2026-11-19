---
title: Frontend Loading State & Skeleton Loaders
description: Mandatory skeleton placeholders and strict prohibition of circular page spinners
---

This standard applies universally across all frontend templates (`template-react` and `template-vue`).

---

## 🚫 Strict Prohibition: Circular Loading Spinners

❌ **STRICTLY PROHIBITED** to use circular spinners for:
- Full-page loading states
- Data tables (`DataTable`)
- Card grids and item lists
- Profile or form detail views

**UX Justification**: Circular page spinners induce severe Cumulative Layout Shift (CLS) and deliver poor perceived responsiveness.

---

## ✅ Mandatory: Skeleton Loaders

Every asynchronous data state must render **Skeleton Loaders** mirroring the structural geometry of the pending content:
- For tables: Render rows of horizontal skeleton bars.
- For profile cards: Render circular skeletons for avatars and matching bars for metadata.
- For charts: Render placeholder skeleton containers matching final dimensions.

---

## ✅ The Action Button Exception

A spinner is permitted **ONLY** inside an active `<Button loading={isSubmitting} />` while a user-triggered action (Submit, Save, Delete) is actively in-flight.
