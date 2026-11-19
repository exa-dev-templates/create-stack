---
title: Golang Worker Template
description: Implementasi RabbitMQ & Apache Kafka consumer dengan goroutine pool, manual Ack/Nack, dan graceful shutdown di Go
---

Template `template-worker-golang` adalah background worker berkinerja tinggi yang ditulis dalam **Go 1.22+**, dirancang untuk memproses tugas-tugas antrean intensif komputasi dengan dukungan ganda message broker (**RabbitMQ** dan **Apache Kafka**).

---

## ✨ Fitur Arsitektur Utama

- **Dual Broker Driver (`MESSAGE_BROKER=rabbitmq|kafka`)**: Satu codebase fleksibel yang dapat dialihkan antara RabbitMQ (AMQP 0.9.1) atau Apache Kafka hanya dengan mengubah konfigurasi environment.
- **QoS Prefetch & Fair Dispatch**: Membatasi antrean inflight per worker (default: QoS 1/10) untuk mencegah *out-of-memory* saat volume antrean melonjak tinggi.
- **Manual Ack / Nack Protocol**:
  - Konfirmasi `Ack(false)` hanya dieksekusi setelah pemrosesan pesan tuntas tanpa error.
  - Penolakan `Nack(false, requeue)` dengan routing ke Dead Letter Queue (DLQ) untuk pesan bermasalah agar tidak memicu infinite loop.
- **Kafka Manual Offset Commit**: Pada mode Kafka, offset dikomit via `r.CommitMessages(ctx, m)` setelah fungsi handler selesai.
- **Graceful Shutdown**: Mendengarkan sinyal OS `SIGINT` dan `SIGTERM` via channel buffer, menyelesaikan pesan yang sedang berjalan, dan menutup koneksi socket secara bersih.
- **Structured JSON Logging**: Modul logger standar monorepo tanpa `fmt.Println`.

---

## ⚡ Implementasi Consumer & Handlers

Berikut adalah arsitektur consumer nyata yang ada di `main.go`:

### 1. RabbitMQ Consumer Loop

```go title="main.go"
// Start memproses pesan antrean RabbitMQ dengan QoS dan manual ack
func (w *RabbitWorker) Start() error {
	msgs, err := w.channel.Consume(
		w.config.QueueName,
		w.config.ConsumerTag,
		false, // autoAck = false (wajib manual ack)
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
		_ = msg.Nack(false, true) // atau false jika dialihkan ke DLQ
		return
	}

	if err := msg.Ack(false); err != nil {
		log.Printf("Error acknowledging message: %v", err)
	}
}
```

### 2. Apache Kafka Consumer Loop

```go title="main.go"
// startKafkaWorker memproses record Apache Kafka dengan manual offset commit
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

### 3. Sinyal OS & Graceful Shutdown

Worker menangkap `os.Interrupt` dan `syscall.SIGTERM` menggunakan channel Go, memberikan jeda agar goroutine menyelesaikan pemrosesan data in-flight sebelum channel socket ditutup:

```go
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
<-sigChan
log.Println("Worker gracefully shutting down...")
```

---

## 📦 Skema Pesan Standar (Message Payload)

```go title="main.go"
type MessagePayload struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Data      map[string]string `json:"data,omitempty"`
	Timestamp int64             `json:"timestamp,omitempty"`
}
```

---

## ⚙️ Variabel Lingkungan & Konfigurasi

```ini title=".env"
# Driver Pilihan: rabbitmq atau kafka
MESSAGE_BROKER=rabbitmq

# Konfigurasi RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
QUEUE_NAME=my_queue
EXCHANGE_NAME=my_exchange
ROUTING_KEY=my_routing_key
CONSUMER_TAG=worker-golang

# Konfigurasi Apache Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=worker-golang-group
KAFKA_TOPIC=app.events
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-worker-golang

# Download dependencies Go module
go mod download

# Menjalankan worker utama (otomatis membaca driver dari .env)
go run main.go

# Menjalankan script test publisher untuk mengirim pesan simulasi
go run publisher.go

# Build executable binary untuk produksi
go build -o worker main.go
```
