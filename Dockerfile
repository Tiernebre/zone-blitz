# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --version

COPY tailwind.config.js ./
COPY src src
RUN ./gradlew --no-daemon clean bootJar -x test

RUN mkdir -p /workspace/extracted \
 && cp build/libs/*.jar /workspace/app.jar \
 && java -Djarmode=tools -jar /workspace/app.jar extract --destination /workspace/extracted

FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app

RUN groupadd --system spring && useradd --system --gid spring spring
USER spring:spring

COPY --from=build /workspace/extracted/ ./

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
