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

Berikut adalah arsitektur consumer nyata yang ada pada template Python:

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
        # Manual Ack setelah sukses
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # Nack tanpa requeue agar diteruskan ke DLQ
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
        # Commit offset manual setelah proses tuntas
        self.consumer.commit()
    except Exception as e:
        logger.error(f"Error processing Kafka message: {e}")
```

### 3. Sinyal OS & Graceful Shutdown

Menangkap sinyal `SIGINT` dan `SIGTERM` untuk menghentikan konsumsi antrean dan menutup koneksi broker secara bersih:

```python title="worker.py"
signal.signal(signal.SIGINT, self._signal_handler)
signal.signal(signal.SIGTERM, self._signal_handler)

def _signal_handler(self, signum: int, frame: Optional[FrameType]) -> None:
    logger.info(f"Received signal {signum}. Shutting down worker gracefully...")
    self.stop()
```

---

## 📦 Skema Pesan Standar (Message Payload)

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

## ⚙️ Variabel Lingkungan & Konfigurasi

```ini title=".env"
# Driver Pilihan: rabbitmq atau kafka
MESSAGE_BROKER=rabbitmq

# Konfigurasi RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_QUEUE=tasks_queue
RABBITMQ_EXCHANGE=tasks_exchange
RABBITMQ_ROUTING_KEY=tasks.#
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

# Buat dan aktifkan virtualenv
python3 -m venv venv
source venv/bin/activate

# Install dependensi
pip install -r requirements.txt

# Jalankan worker utama
python main.py

# Jalankan script publisher test
python publisher.py
```
