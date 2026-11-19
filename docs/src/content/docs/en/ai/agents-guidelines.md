---
title: AI Coding Agent Guidelines & AGENTS.md
description: How AI assistants navigate the monorepo architecture and enforce quality gates
---

This monorepo is engineered specifically for collaborative development with modern AI Coding Assistants (including **Google Antigravity**, **Cursor**, **Claude Code**, and **GitHub Copilot**).

---

## 🤖 The Role of `AGENTS.md`

Located at the repository root and inside each individual template is an `AGENTS.md` file. It serves as an architectural system prompt parsed automatically by coding agents:

1. **Mandatory Global Invariants**: Informs agents of non-negotiable boundaries (zero raw print, mandatory skeletons, explicit transactions).
2. **Template Context**: Teaches agents the exact domain layers and library conventions of the service.
3. **Anti-Hallucination Guardrails**: Prevents autonomous agents from improvising arbitrary libraries or deviating from clean architecture.

---

## 🧠 Agent Context Hierarchy

When an AI Coding Assistant enters the project:
1. It ingests root `AGENTS.md` for project scope and global rules.
2. It consults targeted rules in `.agents/rules/` when validating specific implementations (e.g. database transactions, API response envelopes).
3. It loads specific skills in `.agents/skills/` when prompted to generate features or tests.
