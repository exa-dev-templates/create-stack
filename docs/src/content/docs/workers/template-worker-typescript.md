---
title: TypeScript Worker Template
description: Node.js RabbitMQ & Kafka consumer dengan amqplib, reconnection otomatis, dan typing aman
---

Template `template-worker-typescript` adalah background consumer berbasis **Node.js** dan **TypeScript**, dilengkapi dengan penanganan koneksi ulang otomatis (*reconnect*) dan validasi payload tipe aman.

---

## ⚡ Implementasi Consumer

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
      channel.nack(msg, false, false); // Nack ke DLQ
    }
  });
}

startWorker();
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd worker
npm install
npm run dev
```
