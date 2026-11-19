---
title: TypeScript Worker Template
description: Node.js RabbitMQ & Apache Kafka consumer with amqplib, KafkaJS, auto-reconnect, manual Ack/Nack, and type safety
---

The `template-worker-typescript` template is an enterprise-grade background worker consumer built on **Node.js** and **TypeScript**, engineered with auto-reconnection mechanics, strictly typed payload interfaces, and dual message broker support (**RabbitMQ** and **Apache Kafka**).

---

## ✨ Core Architectural Features

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Pluggable architecture allowing seamless transitions between RabbitMQ (`amqplib`) and Apache Kafka (`kafkajs`).
- **Resilient Connection Lifecycle**: Automatic reconnection handling with configured timeouts and backoff strategies when the message broker restarts.
- **QoS Prefetch & Fair Dispatch**: Tuned `prefetch(10)` to balance processing workloads evenly across multiple consumer pods.
- **Manual Ack / Nack Protocol**:
  - `channel.ack(message)` is executed strictly after asynchronous business logic succeeds.
  - `channel.nack(message, false, false)` routes unrecoverable errors to a Dead Letter Queue (DLQ).
- **Typed Message Payloads**: Strict schema guarantees via TypeScript interfaces (`DefaultMessagePayload`, `EmailMessagePayload`, `PaymentMessagePayload`).
- **Graceful Shutdown**: Intercepts `SIGINT` and `SIGTERM` to safely stop consumers and drain in-flight operations before terminating.
- **Winston Structured JSON Logging**: Structured logging adhering to monorepo standards (`utils/logger.ts`) without raw `console.log`.

---

## ⚡ Consumer Implementation & Handlers

Here is the real consumer implementation from the TypeScript template:

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

                // Manual Ack after successful processing
                this.channel?.ack(msg);
            } catch (error) {
                logger.error('Error processing task, routing to DLQ', { error });
                // Nack without requeue to forward to DLQ
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

### 3. OS Signals & Graceful Shutdown

Handling `SIGINT` and `SIGTERM` signals in `src/index.ts` to cleanly close broker connections before process termination:

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

## 📦 Standard Message Payload Schema

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

## ⚙️ Environment Variables & Configuration

```ini title=".env"
# Selected Driver: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq

# RabbitMQ Settings
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE=tasks_queue
RABBITMQ_EXCHANGE=tasks_exchange
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_ROUTING_KEY=tasks.#
RABBITMQ_PREFETCH=10

# Apache Kafka Settings
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=worker-ts
KAFKA_GROUP_ID=worker-ts-group
KAFKA_TOPIC=app.events
```

---

## 🛠️ Development Commands

```bash title="Terminal"
cd template-worker-typescript

# Install dependencies
npm install

# Run worker in development mode (tsx hot-reload)
npm run dev

# Run simulation test publisher
npm run test:send

# Compile TypeScript to JavaScript (dist/)
npm run build

# Start production build
npm start
```
