---
title: Rust Worker Template
description: Asynchronous RabbitMQ (lapin) & Apache Kafka (rskafka) consumer built with Rust and Tokio runtime for maximum throughput and reliability
---

The `template-worker-rust` template is an ultra-high throughput background queue consumer written in **Rust 2021**, utilizing native asynchronous libraries **Lapin** (AMQP 0.9.1) and **RsKafka** (Apache Kafka) on top of the **Tokio** runtime.

---

## ✨ Core Architectural Features

- **Dual Broker Drivers (`MESSAGE_BROKER=rabbitmq|kafka`)**: Dynamically swaps between RabbitMQ or Apache Kafka consumption pipelines without recompilation.
- **Pure Tokio Async Runtime**: Entire consumer I/O loop runs non-blocking with exceptional concurrency and a tiny memory footprint (< 15 MB).
- **QoS Prefetch & Fair Dispatch**: Enforces `basic_qos` limits on RabbitMQ channels to prevent memory ballooning under load.
- **Manual Acknowledgment & Error Handling**:
  - `delivery.ack(BasicAckOptions::default())` invoked strictly when task processing completes successfully.
  - `delivery.nack(BasicNackOptions { requeue: false, .. })` delegates poisoned messages to Dead Letter Exchanges (DLX).
- **Tokio Select Graceful Shutdown**: Leverages `tokio::sync::broadcast` channels connected to OS termination signals (`SIGINT`/`SIGTERM`) to halt message processing smoothly without data loss.
- **Structured JSON Logging**: `tracing` + `tracing-subscriber` outputs structured JSON logs per event (raw `println!` and `eprintln!` are forbidden).

---

## ⚡ Consumer Implementation & Handlers

RabbitMQ consuming loop and shutdown orchestration in `src/consumer/worker.rs`:

```rust title="src/consumer/worker.rs"
use futures_util::StreamExt;
use lapin::{
    message::Delivery,
    options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions},
    types::FieldTable,
    Channel,
};
use tokio::sync::broadcast;
use tracing::{error, info, warn};

use crate::{
    config::WorkerConfig,
    consumer::task::{process_task, TaskMessage},
};

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

Kafka consuming loop in `src/consumer/kafka_worker.rs`:

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

---

## ⚙️ Environment Variables (`.env`)

```ini title=".env"
# Driver Selection: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq
LOG_LEVEL=info

# RabbitMQ Configuration
AMQP_URL=amqp://guest:guest@localhost:5672/%2f
QUEUE_NAME=worker_rust_queue
EXCHANGE_NAME=worker_rust_exchange
ROUTING_KEY=worker_rust_key
PREFETCH_COUNT=10

# Apache Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=app.events
KAFKA_GROUP_ID=worker-rust-group
```

---

## 🛠️ Development Commands

```bash title="Terminal"
cd template-worker-rust

# Verify compilation and linting
cargo check

# Run main worker
cargo run

# Run with Apache Kafka driver
MESSAGE_BROKER=kafka cargo run

# Run publisher test simulation
cargo run --bin test_publisher

# Build optimized release binary
cargo build --release
```
