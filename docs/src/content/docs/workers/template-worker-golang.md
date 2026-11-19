---
title: Golang Worker Template
description: Implementasi RabbitMQ & Kafka consumer dengan goroutine pool dan graceful shutdown di Go
---

Template `template-worker-golang` adalah background worker berkinerja tinggi yang ditulis dalam **Go 1.22+**, mengonsumsi pesan antrean dengan QoS prefetch dan penanganan sinyal OS.

---

## ⚡ Implementasi Consumer & Graceful Shutdown

```go title="main.go"
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"
    amqp "github.com/rabbitmq/amqp091-go"
    "my-worker/pkg/logging"
)

func main() {
    logger := logging.GetLogger()
    conn, ch := setupRabbitMQ()
    defer conn.Close()
    defer ch.Close()

    // 1. Set QoS Prefetch Count = 10
    _ = ch.Qos(10, 0, false)

    msgs, _ := ch.Consume("task_queue", "worker-go", false, false, false, false, nil)

    // 2. Channel Graceful Shutdown
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        for msg := range msgs {
            err := processJob(msg.Body)
            if err != nil {
                // Nack ke DLQ jika gagal
                msg.Nack(false, false)
            } else {
                msg.Ack(false)
            }
        }
    }()

    <-sigChan
    logger.Info("Worker shutting down cleanly...")
}
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd worker

# Download dependensi
go mod download

# Jalankan worker
go run main.go
```
