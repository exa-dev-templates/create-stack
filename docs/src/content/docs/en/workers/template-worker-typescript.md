---
title: TypeScript Worker Template
description: Node.js RabbitMQ & Kafka consumer with amqplib, automated reconnect, and strict types
---

The `template-worker-typescript` starter kit is an asynchronous background consumer built on **Node.js** and **TypeScript**, with resilient reconnection handling and strongly-typed payloads.

---

## ⚡ Consumer Implementation

```typescript title="src/worker.ts"
import amqplib from 'amqplib';
import { logger } from './pkg/logging';

async function startWorker() {
  const connection = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
  const channel = await connection.createChannel();

  await channel.prefetch(10);
  await channel.assertQueue('task_queue', { durable: true });

  channel.consume('task_queue', async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      logger.info('Processing task', { id: data.id });

      channel.ack(msg);
    } catch (err) {
      logger.error('Failed processing task', { error: err });
      channel.nack(msg, false, false); // Route to DLQ
    }
  });
}

startWorker();
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd worker
npm install
npm run dev
```
