# Runbook — QueueStorm Investigator

## Deployment checklist

- [ ] `GROQ_API_KEY` set in production `.env`
- [ ] `NODE_ENV=production`
- [ ] `RATE_LIMIT_MAX_REQUESTS` ≥ 300 if judge will burst-test
- [ ] Health check passes within 60s of container start
- [ ] `POST /analyze-ticket` responds < 30s with Groq enabled

## Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | 3000 | |
| `REQUEST_TIMEOUT_MS` | 28000 | 2s buffer under judge 30s |
| `GROQ_PROSE_TIMEOUT_MS` | 12000 | Capped by remaining deadline |
| `GROQ_API_KEY` | — | Required in production |
| `RATE_LIMIT_ENABLED` | true | Set false only if judge hits rate limits |
| `RATE_LIMIT_MAX_REQUESTS` | 600 | Per 60s window per IP |

## Health

```bash
curl -s http://localhost:3000/health
# {"status":"ok"}
```

Docker healthcheck: `start_period: 60s` aligned with hackathon readiness window.

## Smoke test

```bash
npm run sample:run
# or
API_URL=https://your-deployed-url npm run sample:run
```

## Logs

Structured JSON via Pino. Each request logs `requestId`, stage timings (`validationMs`, `investigationMs`, `groqMs`), and `proseSource`.

```bash
LOG_LEVEL=debug npm start
```

## Graceful shutdown

SIGTERM/SIGINT → 10s drain → `destroyHttpAgents()` → exit.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 504 REQUEST_TIMEOUT | Groq slow + retries | Lower `GROQ_PROSE_TIMEOUT_MS`; verify fallback works |
| 413 | Body > `JSON_BODY_LIMIT` | Client must trim complaint |
| 422 | Empty complaint after normalization | Client validation |
| 400 VALIDATION_ERROR | Schema/enum violation | Check strict JSON schema |
| 429 | Rate limit | Raise `RATE_LIMIT_MAX_REQUESTS` or disable for judging |

## Groq degradation

If Groq is down, misconfigured, or deadline is tight:

1. `AiProseService` skips or times out Groq
2. Safe template prose is used
3. Business fields unchanged
4. Response still 200 if validation passes

## Security

- Complaint text sanitized before LLM; injection patterns logged
- Output scanned for credential requests and unauthorized refund promises
- Failed safety scan → template fallback (never unsafe LLM text)

## Benchmarks

```bash
npm run benchmark    # deterministic path, no Groq
npm run test:judge   # 65 adversarial cases + load
```

## Rollback

```bash
docker compose -f docker/docker-compose.yml down
# redeploy previous image tag
```
