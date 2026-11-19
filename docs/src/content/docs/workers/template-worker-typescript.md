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

## ⚡ Implementasi Consumer & Handlers

Berikut adalah implementasi consumer nyata yang ada pada template TypeScript:

### 1. RabbitMQ Consumer Loop

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

                await handler(content, msg);

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

### 2. Apache Kafka Consumer Loop

```typescript title="src/services/kafka.service.ts"
public async consume(
    handler: (content: DefaultMessagePayload, context?: { messageId?: string }) => Promise<void>
): Promise<void> {
    if (!this.isConnected) {
        throw new Error('Kafka consumer is not connected');
    }

    await this.consumer.subscribe({ topic: this.config.topic, fromBeginning: false });
    logger.info(`Subscribed to Kafka topic "${this.config.topic}"`);

    await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const messageId = message.key?.toString() || `${topic}-${partition}-${message.offset}`;
            try {
                const rawValue = message.value?.toString() || '{}';
                const content = JSON.parse(rawValue) as DefaultMessagePayload;
                await handler(content, { messageId });
            } catch (err) {
                logger.error('Error processing Kafka message:', {
                    messageId,
                    error: err instanceof Error ? err.message : String(err)
                });
            }
        },
    });
}
```

### 3. Sinyal OS & Graceful Shutdown

Menangkap sinyal `SIGINT` dan `SIGTERM` di `src/index.ts` untuk menutup koneksi broker secara bersih sebelum proses Node.js berhenti:

```typescript title="src/index.ts"
const shutdown = async () => {
    logger.info(`Shutting down ${brokerType.toUpperCase()} worker...`);
    if (brokerType === 'kafka') {
        await kafkaService.close();
    } else {
        await rabbitMQService.close();
    }
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

---

## 📦 Skema Pesan Standar (Message Payload)

```typescript title="src/types/message.types.ts"
export interface BaseMessagePayload {
    timestamp?: string | number;
    correlationId?: string;
}

export interface DefaultMessagePayload extends BaseMessagePayload {
    [key: string]: unknown;
}

export interface EmailMessagePayload extends BaseMessagePayload {
    to: string;
    subject: string;
    body: string;
}

export interface PaymentMessagePayload extends BaseMessagePayload {
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    customerEmail: string;
}
```

---

## ⚙️ Variabel Lingkungan & Konfigurasi

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
