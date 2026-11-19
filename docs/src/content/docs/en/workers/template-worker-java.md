---
title: Java Worker Template
description: Spring Boot background consumer supporting dual brokers RabbitMQ (@RabbitListener) and Apache Kafka (@KafkaListener), Jackson serialization, and concurrency tuning
---

The `template-worker-java` template is an enterprise-grade background consumer built on **Java 17+** and **Spring Boot**, leveraging `@RabbitListener` and `@KafkaListener` alongside Jackson JSON message converters for resilient, high-throughput asynchronous processing.

---

## ✨ Core Architectural Features

- **Dual Broker Driver (`message.broker=rabbitmq|kafka`)**: Uses Spring conditional beans (`@ConditionalOnProperty`) to dynamically initialize RabbitMQ or Kafka consumers without code modifications.
- **Spring AMQP Concurrency Tuning**: Configurable multi-threaded listener pool (`concurrency=3`, `max-concurrency=10`) with `prefetch=5` for scalable parallel batching.
- **Built-in Automatic Retry & DLQ**: Spring AMQP retry template configured with `initial-interval=3000ms` and `max-attempts=3` before forwarding exhausted deliveries to a Dead Letter Queue.
- **Spring Kafka Consumer Group**: Automated JSON deserialization directly into domain models (`Message`) with managed partition offset management.
- **Separation of Concerns**: Decouples business processing (`MessageHandler`) from underlying messaging transport listener protocols.
- **SLF4J Structured Logging**: Logback structured logs capturing message tracing metadata (ID, type, timestamp, and duration).

---

## ⚡ Consumer Implementation & Handlers

Here is the dual listener implementation in `template-worker-java`:

### 1. RabbitMQ Consumer Loop

Activated automatically when `message.broker=rabbitmq` (default):

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
            throw e; // Triggers retry policy or Dead Letter Queue routing
        }
    }
}
```

### 2. Apache Kafka Consumer Loop

Activated automatically when `message.broker=kafka`:

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

### 3. OS Signals & Graceful Shutdown

Spring Boot coordinates JVM shutdown hooks (`SIGINT` and `SIGTERM`). The listener containers reject new queue polls, complete in-flight transactions within the configured grace period, and cleanly dispose connections:

```properties title="application.properties"
# Graceful shutdown Spring Boot lifecycle
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=20s
```

---

## 📦 Standard Message Payload Schema

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

## ⚙️ Environment Variables & Configuration

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

## 🛠️ Development Commands

```bash title="Terminal"
cd template-worker-java

# Compile & download dependencies
./mvnw clean compile

# Run worker service
./mvnw spring-boot:run

# Run with Kafka broker driver
MESSAGE_BROKER=kafka ./mvnw spring-boot:run

# Execute unit & consumer tests
./mvnw test

# Format code according to Spotless monorepo standards
./mvnw spotless:apply
```
