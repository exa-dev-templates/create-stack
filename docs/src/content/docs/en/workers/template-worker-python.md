---
title: Python Worker Template
description: Background consumer built on Python with dual broker support for RabbitMQ (pika) and Apache Kafka (kafka-python), manual Ack/Nack, and graceful shutdown
---

The `template-worker-python` template is an enterprise background consumer built on **Python 3.10+**, engineered for intensive asynchronous batch jobs, background notifications/emails, and streaming data transformations across dual message brokers (**RabbitMQ** and **Apache Kafka**).

---

## ✨ Core Architectural Features

- **Dual Broker Drivers (`MESSAGE_BROKER=rabbitmq|kafka`)**: Dispatches either `RabbitMQWorker` or `KafkaWorker` based on ambient configuration.
- **Strongly Typed Message Schema**: Utilizes `MessagePayload` dataclasses to ensure structural integrity across fields (`type`, `recipient`, `subject`, `body`, `extra`).
- **Manual Acknowledgment & DLQ Support**:
  - Manual `ch.basic_ack(delivery_tag)` issued strictly upon job completion.
  - Rejection via `ch.basic_nack(delivery_tag, requeue=False)` delegating failed messages to the Dead Letter Exchange (DLX).
- **Kafka Manual Offset Commit**: Disables auto-commit (`enable_auto_commit=False`) and triggers `consumer.commit()` exclusively after message callbacks finish.
- **Graceful Shutdown**: Traps `signal.SIGINT` and `signal.SIGTERM`, draining in-progress messages and cleanly terminating consumer connections.
- **Structured Logging**: Built-in Python `logging` configuration formatting ISO timestamps, log levels, and contextual messages.

---

## ⚡ Consumer Implementation & Handlers

The primary entry point lives in `main.py`:

```python title="main.py"
import logging
from config import Config
from kafka_worker import KafkaWorker
from worker import custom_message_handler, MessagePayload, RabbitMQWorker

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def handle_kafka_payload(payload: MessagePayload) -> None:
    logger.info(f"Processing message of type: {payload.type}")
    if payload.type == 'email':
        logger.info(f"Sending email to: {payload.recipient}")
    elif payload.type == 'notification':
        logger.info(f"Sending notification: {payload.message}")
    else:
        logger.info(f"Processed message payload: {payload.type}")

if __name__ == '__main__':
    driver = Config.MESSAGE_BROKER
    logger.info(f"Initializing Worker with driver: [{driver.upper()}]...")

    if driver == 'kafka':
        worker = KafkaWorker()
        worker.start(callback=handle_kafka_payload)
    else:
        rabbit_worker = RabbitMQWorker()
        rabbit_worker.start(callback=custom_message_handler)
```

RabbitMQ worker implementation with QoS and graceful signal handling:

```python title="worker.py"
class RabbitMQWorker:
    def __init__(self, queue_name: Optional[str] = None, prefetch_count: int = 1) -> None:
        self.queue_name: str = queue_name or Config.RABBITMQ_QUEUE
        self.prefetch_count: int = prefetch_count
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[BlockingChannel] = None
        self.should_stop: bool = False

        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

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
            # Manual Ack
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            # Nack without requeue (send to DLQ)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
```

---

## ⚙️ Environment Variables (`.env`)

```ini title=".env"
# Driver Selection: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq

# RabbitMQ Settings
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_QUEUE=my_queue
RABBITMQ_EXCHANGE=my_exchange
RABBITMQ_ROUTING_KEY=my_routing_key
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

# Create virtualenv & activate
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run background worker
python main.py

# Send simulated test message via producer script
python producer_example.py
```
