---
title: Golang Worker Template
description: High-performance RabbitMQ & Apache Kafka consumer with goroutine concurrency, manual Ack/Nack, and graceful shutdown in Go
---

The `template-worker-golang` template is a high-performance background consumer written in **Go 1.22+**, engineered to handle compute-heavy background tasks with dual message broker support (**RabbitMQ** and **Apache Kafka**).

---

## ✨ Core Architectural Features

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: A unified codebase that seamlessly swaps between RabbitMQ (AMQP 0.9.1) and Apache Kafka simply by toggling an environment variable.
- **QoS Prefetch & Fair Dispatch**: Enforces inflight message limits (default: QoS 1/10) to safeguard against memory exhaustion during unexpected traffic spikes.
- **Manual Ack / Nack Protocol**:
  - `Ack(false)` confirmations are executed strictly after successful message processing.
  - `Nack(false, requeue)` rejections with optional Dead Letter Queue (DLQ) routing to prevent poison message infinite loops.
- **Kafka Manual Offset Commit**: In Kafka mode, offsets are committed via `r.CommitMessages(ctx, m)` only when business handlers return without errors.
- **Graceful Shutdown**: Monitors OS termination signals `SIGINT` and `SIGTERM`, draining in-flight messages before closing network sockets.
- **Structured JSON Logging**: Standard monorepo structured logging compliance without raw `fmt.Println`.

---

## ⚡ Consumer Implementation & Handlers

Here is the real consumer architecture in `main.go`:

### 1. RabbitMQ Consumer Loop

```go title="main.go"
// Start consumes RabbitMQ queue messages with QoS and OS signal handling
func (w *RabbitWorker) Start() error {
	msgs, err := w.channel.Consume(
		w.config.QueueName,
		w.config.ConsumerTag,
		false, // autoAck = false (manual ack required)
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case msg, ok := <-msgs:
			if !ok {
				log.Println("RabbitMQ channel closed, exiting...")
				return nil
			}
			w.handleMessage(msg)

		case <-sigChan:
			log.Println("Received shutdown signal, closing RabbitMQ worker cleanly...")
			return nil
		}
	}
}

func (w *RabbitWorker) handleMessage(msg amqp.Delivery) {
	err := processMessage(msg.Body)
	if err != nil {
		log.Printf("Error processing message: %v", err)
		_ = msg.Nack(false, true) // or false to direct to DLQ
		return
	}

	if err := msg.Ack(false); err != nil {
		log.Printf("Error acknowledging message: %v", err)
	}
}
```

### 2. Apache Kafka Consumer Loop

```go title="main.go"
// startKafkaWorker processes Apache Kafka records with manual offset commits
func startKafkaWorker(config KafkaConfig) error {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: config.Brokers,
		GroupID: config.GroupID,
		Topic:   config.Topic,
	})
	defer r.Close()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case <-sigChan:
			log.Println("Received shutdown signal, closing Kafka reader...")
			return nil
		default:
			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			m, err := r.FetchMessage(ctx)
			cancel()

			if err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					continue
				}
				continue
			}

			if err := processMessage(m.Value); err != nil {
				log.Printf("Error processing Kafka message: %v", err)
				continue
			}

			// Manual offset commit
			if err := r.CommitMessages(context.Background(), m); err != nil {
				log.Printf("Failed to commit offset: %v", err)
			}
		}
	}
}
```

### 3. OS Signals & Graceful Shutdown

The worker intercepts `os.Interrupt` and `syscall.SIGTERM` using standard Go channels, allowing in-flight message processing to finish cleanly before terminating socket connections:

```go
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
<-sigChan
log.Println("Worker gracefully shutting down...")
```

---

## 📦 Standard Message Payload Schema

```go title="main.go"
type MessagePayload struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Data      map[string]string `json:"data,omitempty"`
	Timestamp int64             `json:"timestamp,omitempty"`
}
```

---

## ⚙️ Environment Variables & Configuration

```ini title=".env"
# Selected Driver: rabbitmq or kafka
MESSAGE_BROKER=rabbitmq

# RabbitMQ Settings
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
QUEUE_NAME=my_queue
EXCHANGE_NAME=my_exchange
ROUTING_KEY=my_routing_key
CONSUMER_TAG=worker-golang

# Apache Kafka Settings
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=worker-golang-group
KAFKA_TOPIC=app.events
```

---

## 🛠️ Development Commands

```bash title="Terminal"
cd template-worker-golang

# Download Go module dependencies
go mod download

# Run main worker (automatically reads driver from .env)
go run main.go

# Run test publisher simulation
go run publisher.go

# Build optimized production binary
go build -o worker main.go
```
