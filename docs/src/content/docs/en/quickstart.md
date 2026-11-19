---
title: Quickstart Guide
description: How to run the scaffolding CLI and generate your first project
---

import { Tabs, TabItem } from '@astrojs/starlight/components';

There are 3 ways to execute the `@exa31/create-stack` generator:

<Tabs>
  <TabItem label="🚀 1. NPX (Recommended)">
    Open your terminal in any directory (no repo cloning required):

    ```bash title="Terminal"
    npx @exa31/create-stack
    ```

    *This command pulls the latest release from the NPM registry and starts the interactive wizard.*
  </TabItem>
  <TabItem label="💻 2. Local Development">
    If you are modifying templates or the CLI inside this monorepo:

    ```bash title="Terminal"
    # Run the interactive generator
    npm run create
    # or
    npm start
    ```
  </TabItem>
  <TabItem label="🌐 3. Global Command">
    To register the `create-stack` binary globally across your machine:

    ```bash title="Terminal"
    npm run link-cli

    # Now accessible from any directory:
    create-stack
    ```
  </TabItem>
</Tabs>

---

## 📋 System Prerequisites

Before launching generated projects, ensure your workstation has:
- **Node.js**: Version 18+ (Node 20+ LTS recommended).
- **Docker & Docker Compose**: To run local databases, Redis, RabbitMQ, Kafka, and Mailpit.
- **Git**: For automated repository initialization.

---

## 🏃 First Steps After Scaffolding

Once the CLI finishes generating your project, navigate to the folder:

```bash title="Terminal"
# 1. Enter the newly generated project directory
cd my-awesome-app

# 2. Boot up local backing services (Docker)
npm run infra:up

# 3. Start all services concurrently (Frontend, Backend, Worker)
npm run dev:all
```

Access local developer dashboards in your browser:
- 🎨 **Frontend**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend API**: [http://localhost:5000](http://localhost:5000) (Express) / [http://localhost:8000](http://localhost:8000) (FastAPI) / [http://localhost:8080](http://localhost:8080) (Go/Java/Rust)
- 🐰 **RabbitMQ Dashboard**: [http://localhost:15672](http://localhost:15672) (User/Pass: `guest`/`guest`)
- ⚡ **Kafka UI Dashboard**: [http://localhost:8085](http://localhost:8085)
- 📬 **Mailpit Webmail**: [http://localhost:8025](http://localhost:8025)
