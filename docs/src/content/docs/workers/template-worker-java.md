---
title: Java Worker Template
description: Spring Boot background consumer dengan dukungan dual broker RabbitMQ (@RabbitListener) dan Apache Kafka (@KafkaListener), Jackson serialization, dan concurrency tuning
---

Template `template-worker-java` adalah background consumer enterprise berbasis **Java 17+** dan **Spring Boot**, memanfaatkan `@RabbitListener` dan `@KafkaListener` dengan konverter pesan Jackson untuk pemrosesan asynchronous berdaya tahan tinggi.

---

## ✨ Fitur Arsitektur Utama

- **Dual Broker Driver (`message.broker=rabbitmq|kafka`)**: Menggunakan Spring conditional beans (`@ConditionalOnProperty`) untuk mengaktifkan consumer RabbitMQ atau Kafka sesuai kebutuhan tanpa modifikasi kode.
- **Spring AMQP Concurrency Tuning**: Konfigurasi multi-threaded listener pool (`concurrency=3`, `max-concurrency=10`) dan `prefetch=5` untuk pemrosesan paralel yang terukur.
- **Built-in Automatic Retry & DLQ**: Spring AMQP retry template dengan `initial-interval=3000ms` dan `max-attempts=3` sebelum pesan diarahkan ke antrean penampung error.
- **Spring Kafka Consumer Group**: Deserialisasi JSON otomatis ke model objek `Message` dengan manajemen offset terkelola.
- **Separation of Concerns**: Logika bisnis pemrosesan pesan diisolasi ke dalam class `MessageHandler`, terpisah dari protokol transport listener.
- **SLF4J Structured Logging**: Logback terstruktur mencatat metadata pesan (ID, tipe, timestamp, dan durasi).

---

## ⚡ Implementasi Consumer & Handlers

Berikut adalah implementasi listener ganda pada `template-worker-java`:

### 1. RabbitMQ Consumer Loop

Aktif secara otomatis saat `message.broker=rabbitmq` (default):

```java title="src/main/java/com/example/template/workerjava/consumer/MessageConsumer.java"
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "message.broker", havingValue = "rabbitmq", matchIfMissing = true)
public class MessageConsumer {

    private final MessageHandler messageHandler;

    @RabbitListener(queues = "${rabbitmq.queue.name}")
    public void consumeMessage(Message message) {
        try {
            log.info("=== Received RabbitMQ Message ===");
            log.info("Message ID: {}", message.getId());
            log.info("Type: {}", message.getType());
            log.info("Timestamp: {}", message.getTimestamp());

            messageHandler.processMessage(message);

            log.info("Message processed successfully: {}", message.getId());
        } catch (Exception e) {
            log.error("Error processing message: {}", message.getId(), e);
            throw e; // Memicu retry policy atau Dead Letter Queue
        }
    }
}
```

### 2. Apache Kafka Consumer Loop

Aktif secara otomatis saat konfigurasi `message.broker=kafka`:

```java title="src/main/java/com/example/template/workerjava/consumer/KafkaMessageConsumer.java"
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "message.broker", havingValue = "kafka")
public class KafkaMessageConsumer {

    private final MessageHandler messageHandler;

    @KafkaListener(topics = "${kafka.topic:app.events}", groupId = "${spring.kafka.consumer.group-id:java-worker-group}")
    public void consumeKafkaMessage(Message message) {
        try {
            log.info("=== Received Kafka Message ===");
            log.info("Message ID: {}", message.getId());
            log.info("Type: {}", message.getType());

            messageHandler.processMessage(message);

            log.info("Kafka message processed successfully: {}", message.getId());
        } catch (Exception e) {
            log.error("Error processing Kafka message: {}", message.getId(), e);
            throw e;
        }
    }
}
```

### 3. Sinyal OS & Graceful Shutdown

Spring Boot mengelola shutdown hook secara otomatis (`SIGINT` dan `SIGTERM`). Listener container menghentikan pengambilan pesan baru, menyelesaikan transaksi yang sedang berjalan hingga batas timeout, lalu menutup koneksi connection factory:

```properties title="application.properties"
# Graceful shutdown Spring Boot lifecycle
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=20s
```

---

## 📦 Skema Pesan Standar (Message Payload)

```java title="src/main/java/com/example/template/workerjava/model/Message.java"
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message implements Serializable {
    private String id;
    private String content;
    private String type;
    private Long timestamp;
}
```

---

## ⚙️ Variabel Lingkungan & Konfigurasi

```properties title="src/main/resources/application.properties"
spring.application.name=worker-java
message.broker=${MESSAGE_BROKER:rabbitmq}

# RabbitMQ Configuration
spring.rabbitmq.host=${RABBITMQ_HOST:localhost}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}

# Queue Configuration
rabbitmq.queue.name=${RABBITMQ_QUEUE:worker.queue}
rabbitmq.exchange.name=${RABBITMQ_EXCHANGE:worker.exchange}
rabbitmq.routing.key=${RABBITMQ_ROUTING_KEY:worker.routing.key}

# Concurrency & Retry Settings
spring.rabbitmq.listener.simple.concurrency=3
spring.rabbitmq.listener.simple.max-concurrency=10
spring.rabbitmq.listener.simple.prefetch=5
spring.rabbitmq.listener.simple.retry.enabled=true
spring.rabbitmq.listener.simple.retry.initial-interval=3000
spring.rabbitmq.listener.simple.retry.max-attempts=3

# Apache Kafka Configuration
spring.kafka.bootstrap-servers=${KAFKA_BROKERS:localhost:9092}
spring.kafka.consumer.group-id=${KAFKA_GROUP_ID:java-worker-group}
spring.kafka.consumer.auto-offset-reset=latest
kafka.topic=${KAFKA_TOPIC:app.events}
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd template-worker-java

# Compile & download dependensi
./mvnw clean compile

# Menjalankan worker service
./mvnw spring-boot:run

# Menjalankan dengan broker Kafka
MESSAGE_BROKER=kafka ./mvnw spring-boot:run

# Menjalankan unit & consumer tests
./mvnw test

# Format kode sesuai standar Spotless monorepo
./mvnw spotless:apply
```
