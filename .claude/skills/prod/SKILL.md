---
name: prod
description: Inspect the zoneblitz.app production droplet — tail Docker logs, list containers, run read-only DB queries, and probe HTTP health. Use when the user asks to check prod, read logs, debug a live issue, or query the production database.
---

# Prod Skill

Read-only access to the zoneblitz.app production droplet.

- Host: `root@157.245.2.29` (Digital Ocean droplet)
- Public URL: `https://zoneblitz.app` (fronted by Cloudflare)
- Containers (Docker Compose):
  - `zone-blitz-app-1` — app (`ghcr.io/tiernebre/zone-blitz:latest`)
  - `zone-blitz-postgres-1` — Postgres 17 (user/db both `zone_blitz`)
- Logs via `docker logs`; DB via `docker exec ... psql`.

## Quoting — important

`ssh host cmd with --flags` lets the **remote shell** word-split everything,
which mangles `--format '{{.Names}}'` style flags. Always wrap the remote
command in single quotes:

```bash
# WRONG — remote shell splits the format string
ssh root@157.245.2.29 docker ps --format '{{.Names}}'

# RIGHT
ssh root@157.245.2.29 'docker ps --format "{{.Names}}|{{.Status}}"'
```

**This skill is read-only by design.** Restarts, migrations, and anything
mutating must be done by the user or explicitly approved per-action.

## First: discover what's running

```bash
ssh root@157.245.2.29 docker ps
ssh root@157.245.2.29 docker compose ps     # if using compose
```

Use this to find container names before tailing logs or execing into the DB.

## Tail logs

```bash
# Last 200 lines
ssh root@157.245.2.29 docker logs --tail 200 <container>

# Since a timestamp or duration
ssh root@157.245.2.29 docker logs --since 15m <container>
ssh root@157.245.2.29 docker logs --since 2026-04-14T12:00:00 <container>

# Include timestamps
ssh root@157.245.2.29 docker logs --tail 200 --timestamps <container>

# Only stderr
ssh root@157.245.2.29 docker logs --tail 200 <container> 2>&1 >/dev/null
```

Do **not** use `-f` / `--follow` — it blocks. Use `--since` with repeated polls
instead.

## Inspect container state

```bash
ssh root@157.245.2.29 docker inspect <container> \
  --format '{{.State.Status}} started={{.State.StartedAt}} restarts={{.RestartCount}}'
ssh root@157.245.2.29 docker stats --no-stream
```

## Query the database (read-only)

Postgres 17 in `zone-blitz-postgres-1`, user/db both `zone_blitz`.

```bash
ssh root@157.245.2.29 \
  'docker exec zone-blitz-postgres-1 psql -U zone_blitz -d zone_blitz -c "SELECT COUNT(*) FROM users;"'

# List tables
ssh root@157.245.2.29 \
  'docker exec zone-blitz-postgres-1 psql -U zone_blitz -d zone_blitz -c "\dt"'

# Multi-line query via heredoc on the remote side
ssh root@157.245.2.29 'docker exec -i zone-blitz-postgres-1 psql -U zone_blitz -d zone_blitz' <<'SQL'
SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5;
SQL
```

**Rules:**

- `SELECT` / `EXPLAIN` only. No `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`,
  `PRAGMA writes`, `VACUUM`, etc.
- If a mutation is genuinely needed, surface the exact statement to the user and
  let them run it.

## HTTP probes

```bash
curl -sSI https://zoneblitz.app/            # headers
curl -sS https://zoneblitz.app/api/health   # adjust path to real health endpoint
```

## Host health

```bash
ssh root@157.245.2.29 df -h
ssh root@157.245.2.29 free -m
ssh root@157.245.2.29 uptime
```

## Triage recipe (user says "is prod ok?")

1. `curl -sSI https://zoneblitz.app/` — does the edge respond?
2. `ssh root@157.245.2.29 docker ps` — all expected containers Up?
3. `ssh root@157.245.2.29 'docker logs --since 15m --tail 200 zone-blitz-app-1'`
   — any errors/stack traces?
4. `df -h` + `free -m` — disk/memory pressure?
5. Report findings with specifics; don't restart anything without asking.

## When you hit a permission prompt

The allowlist in `.claude/settings.local.json` covers the read-only commands
above. If you need a command outside that list (e.g. `docker restart`, a shell
into a container, a write query), stop and ask the user — don't try to work
around it.
