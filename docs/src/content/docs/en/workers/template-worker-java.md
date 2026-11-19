---
title: Java Worker Template
description: Spring Boot RabbitMQ consumer (@RabbitListener) with Jackson deserialization and concurrency tuning
---

The `template-worker-java` starter kit is an enterprise background consumer built on **Java 17+** and **Spring Boot**, leveraging `@RabbitListener` and typed JSON deserialization.

---

## ⚡ Consumer Implementation

```java title="src/main/java/com/app/worker/TaskConsumer.java"
@Component
@Slf4j
public class TaskConsumer {

    @RabbitListener(queues = "${rabbitmq.queue.name:task_queue}")
    public void handleTask(TaskPayload payload, Channel channel, @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Processing task: {}", payload.getId());
            // Business logic here
            channel.basicAck(tag, false);
        } catch (Exception e) {
            log.error("Failed to process task: {}", e.getMessage());
            try {
                // Route to Dead Letter Queue
                channel.basicNack(tag, false, false);
            } catch (IOException ioEx) {
                log.error("Failed to nack message", ioEx);
            }
        }
    }
}
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd worker
./mvnw spring-boot:run
```
