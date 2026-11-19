---
title: Java (Spring Boot 4) Backend
description: Clean Architecture, Liquibase UP/DOWN, JWT @RequireAuth, dan Swagger UI di template-java
---

Template `template-java` adalah starter kit enterprise backend berbasis **Java 17+** dan **Spring Boot 4**, mengombinasikan kekuatan ekosistem enterprise Java dengan pola Clean Architecture dan keamanan modern.

---

## ✨ Fitur Utama

- **Spring Boot 4**: Framework backend enterprise de-facto dengan performa startup optimal.
- **Liquibase Database Migrations**: Migrasi skema database yang deklaratif dan dapat di-rollback (`UP`/`DOWN`).
- **Standard BaseResponse Envelope**: Format response terstandarisasi yang kompatibel 100% dengan frontend React/Vue.
- **`@RequireAuth` Annotation**: Interceptor JWT kustom untuk proteksi endpoint berbasis deklarasi anotasi yang bersih.
- **Structured JSON Logging**: Dikonfigurasi dengan Logback + Logstash encoder untuk streaming JSON terstruktur (dilarang keras menggunakan `System.out.println`).
- **Distributed Realtime**: Terintegrasi dengan Server-Sent Events (SSE) dan WebSocket (STOMP) yang diskalakan dengan Redis Pub/Sub.
- **Interactive Swagger**: Antarmuka Swagger UI interaktif di `http://localhost:8080/swagger-ui.html`.

---

## ⚡ Implementasi Transaksi Nyata (`@Transactional` Declarative Boundaries)

Sesuai aturan monorepo (`database-transactions.md`), transaksi database dikelola secara deklaratif menggunakan anotasi Spring AOP `@Transactional`. Terdapat pemisahan tegas antara mutasi data (otomatis rollback jika terjadi exception) dan operasi pembacaan (`readOnly = true`) untuk mengoptimalkan performa dirty-checking Hibernate:

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

  // Operasi Mutasi: Rollback otomatis jika runtime exception / BusinessException
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

  // Operasi Pembacaan: Optimasi Hibernate bypass dirty-checking snapshot
  @Transactional(readOnly = true)
  public Optional<User> getUserById(Long id) {
    return userRepository.findById(id);
  }
}
```

---

## 🛠️ Perintah Pengembangan

```bash title="Terminal"
cd backend

# Compile dan jalankan server (port 8080)
./mvnw spring-boot:run

# Jalankan migrasi Liquibase
./mvnw liquibase:update

# Jalankan test suite
./mvnw test
```
