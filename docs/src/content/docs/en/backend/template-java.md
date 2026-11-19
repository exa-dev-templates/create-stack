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

## ⚡ Real-World Transaction Pattern (`@Transactional` Declarative Boundaries)

Per monorepo standard (`database-transactions.md`), database transactions are declared using Spring AOP `@Transactional`. There is an explicit separation between mutations (automatic rollback on uncaught exceptions) and read operations (`readOnly = true`) to optimize Hibernate dirty-checking performance:

```java title="src/main/java/com/example/template/java/user/service/UserService.java"
package com.example.template.java.user.service;

import com.example.template.java.common.constant.ApiCode;
import com.example.template.java.common.exception.BusinessException;
import com.example.template.java.user.dto.UserRequest;
import com.example.template.java.user.model.User;
import com.example.template.java.user.repository.UserRepository;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class UserService {

  private final UserRepository userRepository;

  public UserService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  // Mutation: Automatic rollback on runtime exception or BusinessException
  @Transactional
  public User createUser(UserRequest request) {
    log.info("Creating new user: {}", request.getUsername());

    if (userRepository.findByUsername(request.getUsername()).isPresent()) {
      throw new BusinessException("Username already exists", ApiCode.USER_ALREADY_EXISTS, 409);
    }
    if (userRepository.findByEmail(request.getEmail()).isPresent()) {
      throw new BusinessException("Email already exists", ApiCode.EMAIL_ALREADY_EXISTS, 409);
    }

    User user = new User();
    user.setUsername(request.getUsername());
    user.setEmail(request.getEmail());
    user.setPassword(BCrypt.hashpw(request.getPassword(), BCrypt.gensalt()));
    user.setFullName(request.getFullName());
    user.setRole(request.getRole() != null ? request.getRole() : "USER");
    user.setIsActive(true);

    User savedUser = userRepository.save(user);
    log.info("User created successfully: {}", savedUser.getId());
    return savedUser;
  }

  // Query: Optimized to skip Hibernate dirty-checking snapshots
  @Transactional(readOnly = true)
  public Optional<User> getUserById(Long id) {
    return userRepository.findById(id);
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
