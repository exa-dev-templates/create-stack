---
title: Rust Worker Template
description: Lapin AMQP & RdKafka consumer built on Rust and Tokio runtime with zero overhead
---

The `template-worker-rust` starter kit is an ultra-reliable, zero-overhead background queue worker written in **Rust 2021** using **Lapin** and the **Tokio** asynchronous runtime.

---

## ⚡ Consumer Implementation

```rust title="src/main.rs"
use lapin::{options::*, types::FieldTable, Connection, ConnectionProperties};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::json().init();

    let conn = Connection::connect("amqp://localhost:5672", ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    channel.basic_qos(10, BasicQosOptions::default()).await?;

    let mut consumer = channel
        .basic_consume("task_queue", "rust-worker", BasicConsumeOptions::default(), FieldTable::default())
        .await?;

    info!("Rust worker listening for jobs...");

    while let Some(delivery) = consumer.next().await {
        if let Ok(delivery) = delivery {
            info!("Processing message: {:?}", String::from_utf8_lossy(&delivery.data));
            delivery.ack(BasicAckOptions::default()).await?;
        }
    }

    Ok(())
}
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd worker
cargo run
```
