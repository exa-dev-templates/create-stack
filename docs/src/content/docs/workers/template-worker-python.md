---
title: Python Worker Template
description: Background consumer berbasis Python dengan dukungan dual driver RabbitMQ (pika) dan Apache Kafka (kafka-python), manual Ack/Nack, dan graceful shutdown
---

Template `template-worker-python` adalah background consumer yang dibangun dengan **Python 3.10+**, dirancang untuk memproses tugas komputasi berat, pengiriman email/notifikasi asynchronous, dan sinkronisasi data dengan dukungan ganda broker (**RabbitMQ** dan **Apache Kafka**).

---

## ✨ Fitur Arsitektur Utama

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Otomatis menjalankan `RabbitMQWorker` atau `KafkaWorker` sesuai nilai environment variable.
- **Strongly Typed Message Schema**: Menggunakan dataclass `MessagePayload` untuk validasi struktur data pesan (`type`, `recipient`, `subject`, `body`, `extra`).
- **Manual Acknowledgment & DLQ Support**:
  - Konfirmasi manual `ch.basic_ack(delivery_tag)` saat tugas sukses.
  - Penolakan `ch.basic_nack(delivery_tag, requeue=False)` agar pesan korup otomatis dialihkan ke Dead Letter Exchange (DLX).
- **Kafka Manual Offset Commit**: `enable_auto_commit=False` dan pemanggilan `consumer.commit()` setelah callback selesai mengeksekusi task.
- **Graceful Shutdown**: Menangkap sinyal sistem operasi `signal.SIGINT` dan `signal.SIGTERM`, menghentikan konsumsi antrean, dan menutup koneksi socket secara tertib.
- **Structured Logging**: Konfigurasi modul `logging` standar Python dengan format timestamp, logger name, level, dan message.

---

## ⚡ Implementasi Consumer & Handlers

Orkestrasi utama pada `main.py`:

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

Logika RabbitMQ consumer dengan penanganan sinyal dan QoS:

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

## ⚙️ Variabel Lingkungan (`.env`)

```ini title=".env"
# Driver Pilihan: rabbitmq atau kafka
MESSAGE_BROKER=rabbitmq

# Konfigurasi RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_QUEUE=my_queue
RABBITMQ_EXCHANGE=my_exchange
RABBITMQ_ROUTING_KEY=my_routing_key
RABBITMQ_PREFETCH=1

# Konfigurasi Apache Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=worker-python-group
KAFKA_TOPIC=app.events
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-worker-python

# Buat virtual environment & aktifkan
python3 -m venv venv
source venv/bin/activate

# Install dependensi
pip install -r requirements.txt

# Menjalankan background worker
python main.py

# Mengirim pesan uji coba via producer example
python producer_example.py
```
