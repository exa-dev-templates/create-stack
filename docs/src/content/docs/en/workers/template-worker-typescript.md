---
title: TypeScript Worker Template
description: Node.js RabbitMQ & Apache Kafka consumer with amqplib, KafkaJS, auto-reconnect, manual Ack/Nack, and type safety
---

The `template-worker-typescript` template is a background consumer built on **Node.js** and **TypeScript**, engineered with automatic reconnection handling, strongly typed message payloads, and dual broker support (**RabbitMQ** and **Apache Kafka**).

---

## ✨ Core Architectural Features

- **Dual Broker Drivers (`MESSAGE_BROKER=rabbitmq|kafka`)**: Pluggable driver architecture allowing immediate switching between RabbitMQ (`amqplib`) and Apache Kafka (`kafkajs`).
- **Resilient Connection Lifecycle**: Automatic reconnection with exponential backoff and connection listeners upon network drops.
- **QoS Prefetch & Fair Dispatch**: Default `prefetch(10)` ensures balanced load distribution across horizontally scaled worker replicas.
- **Manual Ack / Nack Protocol**:
  - `channel.ack(message)` confirms processing completion.
  - `channel.nack(message, false, false)` drops poisoned messages into Dead Letter Queues (DLQ) to avoid retry starvation.
- **Typed Message Payloads**: Comprehensive TypeScript interfaces (`DefaultMessagePayload`) validating message structure prior to business logic execution.
- **Graceful Shutdown**: Traps `SIGINT` and `SIGTERM` signals, letting active task handlers finish gracefully before tearing down socket channels.
- **Winston Structured JSON Logging**: Clean JSON-based logging (`utils/logger.ts`) without unformatted `console.log` statements.

---

## ⚡ Consumer Implementation & Services

Worker orchestration takes place in `src/index.ts`:

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

And RabbitMQ consuming logic with manual Ack/Nack:

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

                // Manual Ack on handler success
                this.channel?.ack(msg);
            } catch (error) {
                logger.error('Error processing task, routing to DLQ', { error });
                // Nack without requeue to route to DLQ
                this.channel?.nack(msg, false, false);
            }
        },
        { noAck: false }
    );
}
```

---

## ⚙️ Environment Variables (`.env`)

```ini title=".env"
# Selected Driver: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE=tasks_queue
RABBITMQ_EXCHANGE=tasks_exchange
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_ROUTING_KEY=tasks.#
RABBITMQ_PREFETCH=10

# Apache Kafka Configuration
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

# Start development worker with hot-reload (tsx)
npm run dev

# Send simulated test message
npm run test:send

# Compile TypeScript to dist/
npm run build

# Start production build
npm start
```
