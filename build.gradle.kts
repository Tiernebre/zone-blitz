buildscript {
    dependencies {
        classpath("org.postgresql:postgresql:42.7.4")
        classpath("org.flywaydb:flyway-database-postgresql:11.14.0")
    }
}

plugins {
    java
    id("org.springframework.boot") version "4.0.5"
    id("io.spring.dependency-management") version "1.1.7"
    id("nu.studer.jooq") version "10.1"
    id("org.flywaydb.flyway") version "11.14.0"
    id("com.diffplug.spotless") version "7.0.2"
    idea
    jacoco
}

idea {
    module {
        excludeDirs.add(file(".claude"))
    }
}

group = "app.zoneblitz"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

sourceSets {
    create("gamesimulator") {
        java.srcDir("src/gamesimulator/java")
        resources.srcDir("src/gamesimulator/resources")
        resources.srcDir("data")
        resources.include("bands/**")
    }
}

dependencies {
    "gamesimulatorImplementation"("com.fasterxml.jackson.core:jackson-databind")
    "implementation"(files(sourceSets["gamesimulator"].output))
}

tasks.named<Jar>("bootJar") {
    from(sourceSets["gamesimulator"].output)
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
    implementation("org.thymeleaf.extras:thymeleaf-extras-springsecurity6")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.springframework.session:spring-session-jdbc")

    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    implementation("org.webjars.npm:htmx.org:2.0.4")
    implementation("org.webjars:webjars-locator-core")

    implementation("net.logstash.logback:logstash-logback-encoder:8.0")

    developmentOnly("org.springframework.boot:spring-boot-devtools")

    jooqGenerator("org.postgresql:postgresql")
    jooqGenerator("org.flywaydb:flyway-core")
    jooqGenerator("org.flywaydb:flyway-database-postgresql")
    jooqGenerator("org.testcontainers:postgresql:1.20.4")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-jooq-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:junit-jupiter:1.20.4")
    testImplementation("org.testcontainers:postgresql:1.20.4")
    testImplementation("com.microsoft.playwright:playwright:1.49.0")
    testImplementation("org.assertj:assertj-core")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

jooq {
    version.set("3.19.31")
    configurations {
        create("main") {
            generateSchemaSourceOnCompilation.set(false)
            jooqConfiguration.apply {
                logging = org.jooq.meta.jaxb.Logging.WARN
                jdbc.apply {
                    driver = "org.postgresql.Driver"
                    url = "jdbc:postgresql://localhost:5432/zoneblitz"
                    user = "zoneblitz"
                    password = "zoneblitz"
                }
                generator.apply {
                    name = "org.jooq.codegen.JavaGenerator"
                    database.apply {
                        name = "org.jooq.meta.postgres.PostgresDatabase"
                        inputSchema = "public"
                        excludes = "flyway_schema_history|spring_session|spring_session_attributes"
                    }
                    target.apply {
                        packageName = "app.zoneblitz.jooq"
                        directory = "build/generated-src/jooq/main"
                    }
                    strategy.name = "org.jooq.codegen.DefaultGeneratorStrategy"
                }
            }
        }
    }
}

tasks.named("generateJooq") {
    dependsOn("flywayMigrate")
}

tasks.named("compileJava") {
    dependsOn("generateJooq")
}

tasks.named("compileTestJava") {
    dependsOn("generateJooq")
}

tasks.test {
    dependsOn("generateJooq")
}

flyway {
    url = "jdbc:postgresql://localhost:5432/zoneblitz"
    user = "zoneblitz"
    password = "zoneblitz"
    locations = arrayOf("filesystem:src/main/resources/db/migration")
}

val tailwindBuild =
    tasks.register<Exec>("tailwindBuild") {
        group = "build"
        description = "Compile Tailwind CSS into the static resources classpath."
        inputs.dir("src/main/resources/templates")
        inputs.file("tailwind.config.js")
        inputs.file("src/main/tailwind/input.css")
        outputs.file("src/main/resources/static/css/app.css")
        commandLine(
            "npx",
            "--yes",
            "tailwindcss@3.4.17",
            "-c",
            "tailwind.config.js",
            "-i",
            "src/main/tailwind/input.css",
            "-o",
            "src/main/resources/static/css/app.css",
            "--minify",
        )
    }

tasks.named("processResources") {
    dependsOn(tailwindBuild)
}

spotless {
    java {
        target("src/*/java/**/*.java")
        googleJavaFormat("1.28.0")
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
    kotlinGradle {
        target("*.gradle.kts")
        ktlint()
    }
}

tasks.test {
    useJUnitPlatform {
        excludeTags("e2e")
    }
    finalizedBy(tasks.jacocoTestReport)
}

val e2eTest =
    tasks.register<Test>("e2eTest") {
        group = "verification"
        description = "Runs Playwright end-to-end tests (JUnit tag: e2e)."
        useJUnitPlatform {
            includeTags("e2e")
        }
        testClassesDirs = sourceSets["test"].output.classesDirs
        classpath = sourceSets["test"].runtimeClasspath
        shouldRunAfter(tasks.test)
    }

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    sourceSets(sourceSets["main"], sourceSets["gamesimulator"])
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.register<JavaExec>("emulate") {
    group = "application"
    description = "Run the game-simulator emulator. Args: [seed]"
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("app.zoneblitz.gamesimulator.GameSimEmulator")
    standardInput = System.`in`
    if (project.hasProperty("args")) {
        val raw = (project.property("args") as String).trim()
        if (raw.isNotEmpty()) {
            args(raw.split(" "))
        }
    }
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    val envFile = file(".env")
    if (envFile.exists()) {
        envFile
            .readLines()
            .filter { it.isNotBlank() && !it.trimStart().startsWith("#") }
            .forEach {
                val idx = it.indexOf("=")
                if (idx > 0) {
                    environment(it.substring(0, idx).trim(), it.substring(idx + 1).trim())
                }
            }
    }
}
