---
title: Golang Worker Template
description: RabbitMQ & Kafka consumer with goroutines, manual Ack/Nack, and graceful shutdown in Go
---

The `template-worker-golang` starter kit is an asynchronous background consumer written in **Go 1.22+**, processing message queues with QoS prefetch and graceful OS signal handling.

---

## ⚡ Consumer Implementation & Graceful Shutdown

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

    // 2. Graceful Shutdown Channel
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        for msg := range msgs {
            err := processJob(msg.Body)
            if err != nil {
                // Route to DLQ on failure
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

## 🛠️ Development Workflow

```bash title="Terminal"
cd worker

# Download dependencies
go mod download

# Start worker
go run main.go
```
