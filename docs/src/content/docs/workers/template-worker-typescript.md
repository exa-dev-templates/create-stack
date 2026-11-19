---
title: TypeScript Worker Template
description: Node.js RabbitMQ & Apache Kafka consumer dengan amqplib, KafkaJS, auto-reconnect, manual Ack/Nack, dan typing aman
---

Template `template-worker-typescript` adalah background worker consumer berbasis **Node.js** dan **TypeScript**, dilengkapi dengan penanganan koneksi ulang otomatis (*reconnect*), validasi payload tipe aman, dan dukungan ganda broker (**RabbitMQ** dan **Apache Kafka**).

---

## ✨ Fitur Arsitektur Utama

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Menggunakan arsitektur pluggable yang memudahkan beralih antara RabbitMQ (`amqplib`) dan Apache Kafka (`kafkajs`).
- **Resilient Connection Lifecycle**: Penanganan reconnect otomatis dengan timeout dan graceful retry saat broker mengalami restart jaringan.
- **QoS Prefetch & Fair Dispatch**: Konfigurasi `prefetch(10)` untuk mendistribusikan beban kerja secara seimbang ke beberapa worker pod.
- **Manual Ack / Nack Protocol**:
  - Konfirmasi `channel.ack(message)` setelah handler asinkron berhasil memproses task.
  - Penolakan `channel.nack(message, false, false)` ke Dead Letter Queue (DLQ) jika terjadi error fatal.
- **Typed Message Payloads**: Validasi struktur payload menggunakan interface TypeScript (`DefaultMessagePayload`).
- **Graceful Shutdown**: Menangkap sinyal `SIGINT` dan `SIGTERM` untuk menghentikan konsumsi antrean dan menutup channel/koneksi secara bersih tanpa memutus task yang sedang berlangsung.
- **Winston Structured JSON Logging**: Menggunakan logger JSON terpusat (`utils/logger.ts`) tanpa `console.log`.

---

## ⚡ Implementasi Consumer & Services

Orkestrasi utama berada pada `src/index.ts`:

```typescript title="src/index.ts"
import { kafkaConfig } from './config/kafka.config';
import { rabbitmqConfig } from './config/rabbitmq.config';
import { KafkaService } from './services/kafka.service';
import { RabbitMQService } from './services/rabbitmq.service';
import logger from './utils/logger';
import { handleMessage } from './workers/message.worker';

async function main() {
    const brokerType = (process.env.MESSAGE_BROKER || 'rabbitmq').toLowerCase();
    logger.info(`Starting Worker with driver: [${brokerType.toUpperCase()}]...`);

    if (brokerType === 'kafka') {
        const kafkaService = new KafkaService(kafkaConfig);
        await kafkaService.connect();
        await kafkaService.consume(handleMessage);
        logger.info('Kafka Worker is running and waiting for events...');

        const shutdown = async () => {
            logger.info('Shutting down Kafka worker...');
            await kafkaService.close();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } else {
        const rabbitMQService = new RabbitMQService(rabbitmqConfig);
        await rabbitMQService.connect();
        await rabbitMQService.consume(handleMessage);
        logger.info('RabbitMQ Worker is running and waiting for messages...');

        const shutdown = async () => {
            logger.info('Shutting down RabbitMQ worker...');
            await rabbitMQService.close();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
}

main().catch((err) => {
    logger.error('Fatal worker startup error', { error: String(err) });
    process.exit(1);
});
```

Dan implementasi konsumsi RabbitMQ dengan manual Ack/Nack:

```typescript title="src/services/rabbitmq.service.ts"
async consume(handler: MessageHandler): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    await this.channel.consume(
        this.config.queue,
        async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
                const content = JSON.parse(msg.content.toString());
                logger.info('Processing task message', { id: content.id });

                await handler(content);

                // Manual Ack setelah handler sukses
                this.channel?.ack(msg);
            } catch (error) {
                logger.error('Error processing task, routing to DLQ', { error });
                // Nack tanpa requeue agar masuk ke DLQ
                this.channel?.nack(msg, false, false);
            }
        },
        { noAck: false }
    );
}
```

---

## ⚙️ Variabel Lingkungan (`.env`)

```ini title=".env"
# Driver Pilihan: rabbitmq atau kafka
MESSAGE_BROKER=rabbitmq

# Konfigurasi RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE=tasks_queue
RABBITMQ_EXCHANGE=tasks_exchange
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_ROUTING_KEY=tasks.#
RABBITMQ_PREFETCH=10

# Konfigurasi Apache Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=worker-ts
KAFKA_GROUP_ID=worker-ts-group
KAFKA_TOPIC=app.events
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-worker-typescript

# Install dependencies
npm install

# Jalankan worker dalam mode development (tsx hot-reload)
npm run dev

# Jalankan pengirim pesan simulasi
npm run test:send

# Build kode ke JavaScript (dist/)
npm run build

# Menjalankan hasil build produksi
npm start
```
