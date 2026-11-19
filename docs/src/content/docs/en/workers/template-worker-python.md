---
title: Python Worker Template
description: Python-based background consumer supporting dual drivers RabbitMQ (pika) and Apache Kafka (kafka-python), manual Ack/Nack, and graceful shutdown
---

The `template-worker-python` template is an asynchronous background consumer built on **Python 3.10+**, designed for handling compute-heavy tasks, asynchronous email/notification dispatch, and data synchronization with dual message broker support (**RabbitMQ** and **Apache Kafka**).

---

## ✨ Core Architectural Features

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Automatically spins up either `RabbitMQWorker` or `KafkaWorker` based on environment configuration.
- **Strongly Typed Message Schema**: Uses dataclass `MessagePayload` for strict payload validation (`type`, `recipient`, `subject`, `body`, `extra`).
- **Manual Acknowledgment & DLQ Support**:
  - Manual confirmation via `ch.basic_ack(delivery_tag)` upon successful task completion.
  - Rejection via `ch.basic_nack(delivery_tag, requeue=False)` to divert poison messages to a Dead Letter Exchange (DLX).
- **Kafka Manual Offset Commit**: `enable_auto_commit=False` and explicit `consumer.commit()` calls after callback execution.
- **Graceful Shutdown**: Catches operating system signals `signal.SIGINT` and `signal.SIGTERM`, halting consumer loops and closing sockets cleanly.
- **Structured Logging**: Standard Python `logging` configuration with timestamp, logger namespace, level, and message metadata.

---

## ⚡ Consumer Implementation & Handlers

Here is the real consumer architecture in the Python worker template:

### 1. RabbitMQ Consumer Loop

```python title="worker.py"
def _default_message_handler(
    self,
    ch: BlockingChannel,
    method: Basic.Deliver,
    properties: BasicProperties,
    body: bytes
) -> None:
    try:
        payload_data = json.loads(body.decode('utf-8'))
        logger.info(f"Successfully processed message: {payload_data}")
        # Manual Ack after completion
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # Nack without requeue to route to DLQ
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
```

### 2. Apache Kafka Consumer Loop

```python title="kafka_worker.py"
self.consumer = KafkaConsumer(
    self.topic,
    bootstrap_servers=self.brokers,
    group_id=self.group_id,
    auto_offset_reset='earliest',
    enable_auto_commit=False,
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

logger.info(f"Kafka worker listening on topic: {self.topic}...")
for message in self.consumer:
    if self.should_stop:
        break
    try:
        raw_data = message.value
        payload = MessagePayload(
            type=raw_data.get('type', 'unknown'),
            recipient=raw_data.get('recipient'),
            subject=raw_data.get('subject'),
            body=raw_data.get('body'),
            message=raw_data.get('message'),
            extra={k: v for k, v in raw_data.items() if k not in {'type', 'recipient', 'subject', 'body', 'message'}}
        )
        if callback:
            callback(payload)
        # Commit Kafka offset manually
        self.consumer.commit()
    except Exception as e:
        logger.error(f"Error processing Kafka message: {e}")
```

### 3. OS Signals & Graceful Shutdown

Handling `SIGINT` and `SIGTERM` signals to stop receiving new messages and release network connections:

```python title="worker.py"
signal.signal(signal.SIGINT, self._signal_handler)
signal.signal(signal.SIGTERM, self._signal_handler)

def _signal_handler(self, signum: int, frame: Optional[FrameType]) -> None:
    logger.info(f"Received signal {signum}. Shutting down worker gracefully...")
    self.stop()
```

---

## 📦 Standard Message Payload Schema

```python title="worker.py"
@dataclass
class MessagePayload:
    """Strongly typed message payload structure"""
    type: str
    recipient: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    message: Optional[str] = None
    extra: Optional[dict[str, Any]] = None
```

---

## ⚙️ Environment Variables & Configuration

```ini title=".env"
# Selected Driver: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq

# RabbitMQ Settings
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_QUEUE=tasks_queue
RABBITMQ_EXCHANGE=tasks_exchange
RABBITMQ_ROUTING_KEY=tasks.#
RABBITMQ_PREFETCH=1

# Apache Kafka Settings
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=worker-python-group
KAFKA_TOPIC=app.events
```

---

## 🛠️ Development Commands

```bash title="Terminal"
cd template-worker-python

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run main worker
python main.py

# Run test publisher simulation
python publisher.py
```
