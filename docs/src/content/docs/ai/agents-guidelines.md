---
title: Panduan AI Assistant & AGENTS.md
description: Bagaimana AI Coding Assistant beroperasi dalam monorepo dan mematuhi panduan
---

Monorepo ini didesain khusus agar dapat dipahami dan dikembangkan bersama AI Coding Assistant modern (seperti **Google Antigravity**, **Cursor**, **Claude Code**, dan **GitHub Copilot**).

---

## 🤖 Peran `AGENTS.md`

Di root repositori dan di setiap folder template terdapat file `AGENTS.md`. File ini berfungsi sebagai "otak arsitektur" yang dibaca otomatis oleh AI agent saat pertama kali membuka workspace:

1. **Aturan Global Wajib**: Memberitahu AI batasan ketat (dilarang print mentah, wajib skeleton loader, wajib transaksi database murni).
2. **Konteks Template**: Menjelaskan stack teknologi dan konvensi spesifik template tersebut.
3. **Pemberitahuan Larangan Halusinasi**: Mencegah AI menambahkan package sembarangan atau mengarang pola arsitektur baru.

---

## 🧠 Hierarki Pembacaan AI

Ketika AI Coding Assistant bekerja pada project:
1. AI membaca `AGENTS.md` di level root untuk memahami gambaran besar dan aturan global.
2. AI membaca file aturan spesifik di `.agents/rules/` jika perlu memvalidasi standar (misal: saat menulis query DB atau membuat controller baru).
3. AI mengeksekusi instruksi dari skill spesifik di `.agents/skills/` saat diminta membuat fitur baru.
