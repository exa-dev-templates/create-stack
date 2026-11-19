---
title: Java Worker Template
description: Spring Boot RabbitMQ consumer (@RabbitListener) dengan konverter Jackson dan concurrency tuning
---

Template `template-worker-java` adalah background consumer berbasis **Java 17+** dan **Spring Boot**, memanfaatkan `@RabbitListener` dan Jackson Message Converter untuk deserialisasi tipe aman.

---

## ⚡ Implementasi Consumer

```java title="src/main/java/com/app/worker/TaskConsumer.java"
@Component
@Slf4j
public class TaskConsumer {

    @RabbitListener(queues = "${rabbitmq.queue.name:task_queue}")
    public void handleTask(TaskPayload payload, Channel channel, @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Processing task: {}", payload.getId());
            // Logika proses job
            channel.basicAck(tag, false);
        } catch (Exception e) {
            log.error("Failed to process task: {}", e.getMessage());
            try {
                // Nack ke Dead Letter Queue
                channel.basicNack(tag, false, false);
            } catch (IOException ioEx) {
                log.error("Failed to nack message", ioEx);
            }
        }
    }
}
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd worker
./mvnw spring-boot:run
```
