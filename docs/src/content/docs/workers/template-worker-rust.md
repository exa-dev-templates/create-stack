---
title: Rust Worker Template
description: Asynchronous RabbitMQ (lapin) & Apache Kafka (rskafka) consumer berbasis Rust dan Tokio runtime dengan keandalan dan kecepatan mutlak
---

Template `template-worker-rust` adalah worker antrean berkinerja mutlak yang ditulis dalam **Rust 2021**, menggunakan pustaka native asynchronous **Lapin** (AMQP 0.9.1) dan **RsKafka** (Apache Kafka) di atas runtime **Tokio**.

---

## ✨ Fitur Arsitektur Utama

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Memilih secara dinamis antara consumer RabbitMQ atau consumer Apache Kafka tanpa kompilasi ulang.
- **Pure Tokio Async Runtime**: Seluruh I/O antrean dieksekusi secara non-blocking dengan konkurensi efisien dan footprint memori sangat rendah (< 15 MB).
- **QoS Prefetch & Fair Dispatch**: Menetapkan batasan `basic_qos` pada channel RabbitMQ untuk mencegah penumpukan beban.
- **Manual Acknowledgment & Error Handling**:
  - `delivery.ack(BasicAckOptions::default())` hanya dipanggil jika task berhasil diproses.
  - `delivery.nack(BasicNackOptions { requeue: false, .. })` untuk meneruskan payload korup ke Dead Letter Exchange (DLX).
- **Tokio Select Graceful Shutdown**: Menggunakan channel `tokio::sync::broadcast` yang dipicu oleh sinyal terminasi OS (`SIGINT`/`SIGTERM`) untuk menghentikan loop konsumsi secara mulus tanpa kehilangan data in-flight.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` menghasilkan log JSON terstruktur per event (dilarang keras menggunakan `println!` atau `eprintln!`).

---

## ⚡ Implementasi Consumer & Handlers

Berikut adalah arsitektur consumer nyata yang ada pada template Rust:

### 1. RabbitMQ Consumer Loop

Loop konsumsi RabbitMQ dengan manual Ack/Nack di `src/consumer/worker.rs`:

```rust title="src/consumer/worker.rs"
pub async fn start_consumer(
    channel: Channel,
    config: WorkerConfig,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut consumer = channel
        .basic_consume(
            &config.queue_name,
            "template_worker_rust_consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!(queue = %config.queue_name, "Worker consumer loop started, waiting for messages...");

    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                info!("Shutdown signal received in consumer loop. Halting message consumption cleanly...");
                break;
            }
            Some(delivery_result) = consumer.next() => {
                match delivery_result {
                    Ok(delivery) => {
                        handle_delivery(&delivery).await;
                    }
                    Err(err) => {
                        error!(error = %err, "Error reading message from AMQP stream");
                    }
                }
            }
        }
    }

    Ok(())
}

async fn handle_delivery(delivery: &Delivery) {
    match serde_json::from_slice::<TaskMessage>(&delivery.data) {
        Ok(task) => {
            if let Err(e) = process_task(&task).await {
                error!(error = %e, "Task execution failed, routing to DLQ");
                let _ = delivery.nack(BasicNackOptions { requeue: false, multiple: false }).await;
            } else {
                let _ = delivery.ack(BasicAckOptions::default()).await;
            }
        }
        Err(err) => {
            error!(error = %err, "Failed to parse task payload, dropping message to DLQ");
            let _ = delivery.nack(BasicNackOptions { requeue: false, multiple: false }).await;
        }
    }
}
```

### 2. Apache Kafka Consumer Loop

Loop konsumsi RsKafka di `src/consumer/kafka_worker.rs`:

```rust title="src/consumer/kafka_worker.rs"
pub async fn start_kafka_consumer(
    config: WorkerConfig,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = ClientBuilder::new(config.kafka_brokers.clone()).build().await?;
    let partition_client = Arc::new(
        client.partition_client(&config.kafka_topic, 0, UnknownTopicHandling::Retry).await?
    );

    let mut stream = StreamConsumerBuilder::new(partition_client, StartOffset::Latest)
        .with_max_wait_ms(200)
        .build();

    info!(topic = %config.kafka_topic, "Kafka consumer listening for events...");

    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                info!("Shutdown signal received in Kafka consumer loop. Halting...");
                break;
            }
            Some(record_result) = stream.next() => {
                if let Ok((record, _high_watermark)) = record_result {
                    if let Some(val) = &record.record.value {
                        let _ = process_raw_kafka_payload(val).await;
                    }
                }
            }
        }
    }

    Ok(())
}
```

### 3. Sinyal OS & Graceful Shutdown

Menggunakan sinyal OS Tokio (`tokio::signal::ctrl_c()`) dan broadcast channel untuk mematikan seluruh task secara bersamaan tanpa memutus proses yang sedang berjalan:

```rust title="src/main.rs"
tokio::select! {
    _ = tokio::signal::ctrl_c() => {
        info!("Termination signal intercepted. Broadcasting shutdown to worker tasks...");
        let _ = shutdown_tx.send(());
    }
}
```

---

## 📦 Skema Pesan Standar (Message Payload)

```rust title="src/consumer/task.rs"
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskMessage {
    pub id: String,
    pub task_type: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}
```

---

## ⚙️ Variabel Lingkungan & Konfigurasi

```ini title=".env"
# Driver Pilihan: rabbitmq atau kafka
MESSAGE_BROKER=rabbitmq
LOG_LEVEL=info

# Konfigurasi RabbitMQ
AMQP_URL=amqp://guest:guest@localhost:5672/%2f
QUEUE_NAME=worker_rust_queue
EXCHANGE_NAME=worker_rust_exchange
ROUTING_KEY=worker_rust_key
PREFETCH_COUNT=10

# Konfigurasi Apache Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=app.events
KAFKA_GROUP_ID=worker-rust-group
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-worker-rust

# Validasi kompilasi dan linting
cargo check

# Menjalankan worker utama
cargo run

# Menjalankan dengan Apache Kafka
MESSAGE_BROKER=kafka cargo run

# Menjalankan binary simulasi publisher test
cargo run --bin test_publisher

# Build biner rilis teroptimasi
cargo build --release
```
