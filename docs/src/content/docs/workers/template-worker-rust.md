---
title: Rust Worker Template
description: Lapin AMQP & RdKafka consumer berbasis Rust dan Tokio runtime dengan keandalan maksimal
---

Template `template-worker-rust` adalah worker antrean berkinerja mutlak yang ditulis dalam **Rust 2021**, menggunakan pustaka **Lapin** dan runtime **Tokio**.

---

## ⚡ Implementasi Consumer

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

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd worker
cargo run
```
