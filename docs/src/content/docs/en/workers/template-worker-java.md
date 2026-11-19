---
title: Java Worker Template
description: Spring Boot background consumer supporting dual brokers with RabbitMQ (@RabbitListener) and Apache Kafka (@KafkaListener), Jackson serialization, and concurrency tuning
---

The `template-worker-java` template is an enterprise background consumer built on **Java 17+** and **Spring Boot**, leveraging `@RabbitListener` and `@KafkaListener` alongside Jackson message conversion for resilient asynchronous processing.

---

## ✨ Core Architectural Features

- **Dual Broker Drivers (`message.broker=rabbitmq|kafka`)**: Uses Spring conditional components (`@ConditionalOnProperty`) to initialize RabbitMQ or Kafka consumers without code alterations.
- **Spring AMQP Concurrency Tuning**: Preconfigured multi-threaded listener pools (`concurrency=3`, `max-concurrency=10`) with `prefetch=5` for controlled parallel throughput.
- **Built-in Automatic Retry & DLQ**: Spring AMQP retry policies (`initial-interval=3000ms`, `max-attempts=3`) before delegating problematic messages to dead letter routing.
- **Spring Kafka Consumer Group**: Automatic JSON deserialization to `Message` domain models with managed offset commits.
- **Separation of Concerns**: Message business logic is cleanly decoupled inside `MessageHandler`, isolating payload logic from transport protocols.
- **SLF4J Structured Logging**: Logback produces structured logs containing message metadata (ID, type, timestamp, processing duration).

---

## ⚡ Consumer Implementation & Handlers

Here is the dual-broker listener architecture in `template-worker-java`:

### 1. RabbitMQ Consumer (`MessageConsumer.java`)
Active when `message.broker=rabbitmq` (default):

```java title="src/main/java/com/example/template/workerjava/consumer/MessageConsumer.java"
package com.example.template.workerjava.consumer;

import com.example.template.workerjava.model.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

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
            throw e; // Triggers retry policy or DLQ
        }
    }
}
```

### 2. Kafka Consumer (`KafkaMessageConsumer.java`)
Active when `message.broker=kafka`:

```java title="src/main/java/com/example/template/workerjava/consumer/KafkaMessageConsumer.java"
package com.example.template.workerjava.consumer;

import com.example.template.workerjava.model.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

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

---

## ⚙️ Configuration Properties (`application.properties`)

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

# Run with Apache Kafka driver
MESSAGE_BROKER=kafka ./mvnw spring-boot:run

# Run unit & consumer test suites
./mvnw test

# Format code with monorepo Spotless standard
./mvnw spotless:apply
```
