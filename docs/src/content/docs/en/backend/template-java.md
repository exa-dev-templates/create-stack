---
title: Java (Spring Boot 4) Backend
description: Clean Architecture, Liquibase UP/DOWN, JWT @RequireAuth, and Swagger UI in template-java
---

The `template-java` starter kit is an enterprise-grade backend template built with **Java 17+** and **Spring Boot 4**, uniting the reliability of the Java ecosystem with Clean Architecture and modern security.

---

## ✨ Key Features

- **Spring Boot 4**: Industry-standard enterprise application framework.
- **Liquibase Database Migrations**: Declarative database evolutions with full bidirectional rollback capabilities (`UP`/`DOWN`).
- **Standard BaseResponse Envelope**: Standardized response structure identical to Express, Go, and FastAPI templates.
- **`@RequireAuth` Annotation**: Custom declarative JWT interceptor protecting endpoints with fine-grained role evaluation.
- **Structured JSON Logging**: Logback configured with Logstash JSON encoders (zero `System.out.println` calls).
- **Distributed Realtime**: Out-of-the-box support for SSE and WebSocket (STOMP) scaled via Redis Pub/Sub.
- **Interactive Swagger**: Comprehensive Swagger UI accessible at `http://localhost:8080/swagger-ui.html`.

---

## ⚡ Transaction Implementation Pattern

Transactions are managed declaratively using Spring's transaction boundary:

```java title="src/main/java/com/app/service/UserService.java"
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS, "Email is already registered");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        user = userRepository.save(user);
        return UserResponse.from(user);
    }
}
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd backend

# Compile and run development server (port 8080)
./mvnw spring-boot:run

# Apply Liquibase database migrations
./mvnw liquibase:update

# Run tests
./mvnw test
```
