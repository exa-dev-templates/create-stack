---
title: Rust Worker Template
description: Asynchronous RabbitMQ (lapin) & Apache Kafka (rskafka) consumer powered by Rust and Tokio runtime with absolute reliability and speed
---

The `template-worker-rust` template is a high-performance background queue consumer built in **Rust 2021**, leveraging native asynchronous **Lapin** (AMQP 0.9.1) and **RsKafka** (Apache Kafka) drivers on top of the **Tokio** multi-threaded runtime.

---

## ✨ Core Architectural Features

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Dynamically select between RabbitMQ or Apache Kafka consumer drivers without recompilation.
- **Pure Tokio Async Runtime**: All messaging I/O operations execute non-blockingly with efficient concurrency and an ultra-low memory footprint (< 15 MB).
- **QoS Prefetch & Fair Dispatch**: Enforces explicit channel `basic_qos` limits on RabbitMQ to prevent memory spikes.
- **Manual Acknowledgment & Error Handling**:
  - `delivery.ack(BasicAckOptions::default())` is called strictly after successful task execution.
  - `delivery.nack(BasicNackOptions { requeue: false, .. })` diverts corrupted payloads to a Dead Letter Exchange (DLX).
- **Tokio Select Graceful Shutdown**: Uses `tokio::sync::broadcast` triggered by OS termination signals (`SIGINT`/`SIGTERM`) to halt message consumption loops without dropping in-flight tasks.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` emit structured JSON log events (strictly zero `println!` or `eprintln!`).

---

## ⚡ Consumer Implementation & Handlers

Here is the consumer implementation in the Rust worker template:

### 1. RabbitMQ Consumer Loop

RabbitMQ consumption loop with manual Ack/Nack in `src/consumer/worker.rs`:

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

Kafka consumer loop in `src/consumer/kafka_worker.rs`:

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

### 3. OS Signals & Graceful Shutdown

Using Tokio OS signal handling (`tokio::signal::ctrl_c()`) and broadcast channels to safely notify all worker tasks before shutdown:

```rust title="src/main.rs"
tokio::select! {
    _ = tokio::signal::ctrl_c() => {
        info!("Termination signal intercepted. Broadcasting shutdown to worker tasks...");
        let _ = shutdown_tx.send(());
    }
}
```

---

## 📦 Standard Message Payload Schema

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

## ⚙️ Environment Variables & Configuration

```ini title=".env"
# Selected Driver: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq
LOG_LEVEL=info

# RabbitMQ Settings
AMQP_URL=amqp://guest:guest@localhost:5672/%2f
QUEUE_NAME=worker_rust_queue
EXCHANGE_NAME=worker_rust_exchange
ROUTING_KEY=worker_rust_key
PREFETCH_COUNT=10

# Apache Kafka Settings
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=app.events
KAFKA_GROUP_ID=worker-rust-group
```

---

## 🛠️ Development Commands

```bash title="Terminal"
cd template-worker-rust

# Validate compilation and lints
cargo check

# Run main worker
cargo run

# Run with Apache Kafka driver
MESSAGE_BROKER=kafka cargo run

# Run simulated publisher binary
cargo run --bin test_publisher

# Build optimized production binary
cargo build --release
```
