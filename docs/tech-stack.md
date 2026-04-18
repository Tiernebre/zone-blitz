# Tech Stack

## Runtime & Framework

- **Language:** Java, latest LTS.
- **Framework:** Spring Boot, latest LTS / GA line.
- **Build tool:** Gradle (Kotlin DSL).
- **JVM packaging:** standard fat JAR, run under a slim JRE base image.

## Data

- **Database:** PostgreSQL 16 (per `compose.yaml`).
- **DB access:** jOOQ — typed SQL, code generation from the live schema.
- **Migrations:** Flyway — SQL-first migrations run on app start; jOOQ code generation reads the migrated schema.
- **Local DB:** Docker Compose (`compose.yaml`), single `postgres` service.

## Frontend

- **Template engine:** Thymeleaf — natural HTML templates, deep Spring integration (form binding, validation, Spring Security dialect), largest HTMX + Spring example base to lean on.
- **Interactivity:** HTMX for partial updates / AJAX swaps. Templates should stay thin — most partials are dumb fragments driven by controllers.
- **Packaging:** templates and static assets bundled into the Spring Boot JAR — single deploy artifact, same-origin, no CORS.
- **Styling:** Tailwind CSS. Built via the Tailwind CLI as part of the Gradle build; generated stylesheet ends up on the classpath and is served as a static asset from the JAR.
- **JS posture:** minimize bespoke JS; reach for Alpine.js or small vanilla sprinkles only where HTMX isn't sufficient.
- **Icons:** Heroicons (MIT, from the Tailwind team). Inlined as SVGs in a Thymeleaf fragment file (`templates/icons.html`), one `th:fragment` per icon, referenced via `th:replace="~{icons :: name(cls='size-5 text-slate-600')}"`. No runtime JS, Tailwind drives sizing/color via `currentColor`. Icons are added on demand rather than shipping the full set.

## Deployment

- **Host:** single DigitalOcean Droplet.
- **Runtime:** Docker, orchestrated via `docker compose` on the droplet.
- **Services on droplet:** app container + Postgres container. No local reverse proxy.
- **TLS / edge:** Cloudflare sits in front of the droplet — DNS, TLS termination, CDN/caching of static assets, and DDoS/WAF protection. Origin accepts traffic only from Cloudflare.
- **Domain:** zoneblitz.app.
- **CI/CD:** GitHub Actions — build + test on push, build Docker image, push to a registry (GHCR likely), droplet pulls the new image and restarts via `docker compose`.

## Testing

- **Runner + assertions:** JUnit 5 with AssertJ for fluent assertions.
- **Mocking:** Mockito, used sparingly — prefer real collaborators where cheap.
- **Database / integration:** Testcontainers running Postgres 17 (same major version as prod). Flyway migrates the container on startup so tests exercise the real schema and real jOOQ-generated code.
- **Web layer:** Spring MockMvc — covers both `@WebMvcTest` slice tests for controller logic and `@SpringBootTest` + MockMvc end-to-end flows that assert on rendered HTMX fragments.
- **End-to-end / browser:** Playwright for Java — small suite covering golden-path flows (sign-in, core game actions, HTMX swaps) against a fully booted app + Testcontainers Postgres.
- **Coverage:** JaCoCo — report published in CI as a directional signal, not a hard gate.

## Observability

- **Metrics / health:** Spring Boot Actuator + Micrometer — `/actuator/health`, `/actuator/metrics`, JVM and HTTP metrics out of the box. Sensitive endpoints locked down via Spring Security.
- **Logs:** Logback configured with a JSON encoder, written to stdout. Docker captures container logs; `docker compose logs` (and the `prod` skill) is the day-one read path. Structured fields mean a managed aggregator can be added later without re-instrumenting.
- **Headroom:** traces, dashboards (Grafana Cloud / Loki), error tracking (Sentry), and uptime pings are deferred until there's a real need — the JSON log + Actuator foundation keeps those additions cheap.

## Auth

- **Library:** Spring Security with `spring-boot-starter-oauth2-client`.
- **Provider:** Google (OAuth 2.0 / OIDC). Client credentials from Google Cloud Console; redirect URI `https://zoneblitz.app/login/oauth2/code/google`.
- **User persistence:** on first successful login, upsert a `users` row keyed by Google `sub` (email + name stored for display; `sub` is the stable identity).
- **Session:** standard server-side session cookie (Spring Session-backed if we later need horizontal scale; in-memory is fine on one droplet).
- **Scope to start:** Google-only. Spring Security leaves room to add magic-link, email/password, or additional OAuth providers later without rearchitecting.

## Sim engine

- Packaged in the same Spring Boot JAR as the web app — single deploy artifact, direct in-process calls, no network hop. Kept as its own Gradle source set / package for clean boundaries; can be extracted later if scale ever demands it.

