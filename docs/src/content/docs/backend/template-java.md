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

## ⚡ Contoh Implementasi Transaction

Transaksi database dikelola secara deklaratif menggunakan anotasi Spring:

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
