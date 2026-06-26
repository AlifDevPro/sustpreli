# QueueStorm Investigator

An HTTP API that triages digital-finance support tickets: it investigates complaints against transaction history, classifies the case, routes to the right department, and drafts safe agent/customer text — with **deterministic business logic** and **optional Groq LLM prose**.

---

## Table of contents

- [What it does](#what-it-does)
- [Key features](#key-features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Example request & response](#example-request--response)
- [Case types & routing](#case-types--routing)
- [Safety guarantees](#safety-guarantees)
- [Project structure](#project-structure)
- [Scripts & testing](#scripts--testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Hackathon constraints](#hackathon-constraints)
- [Further reading](#further-reading)

---

## What it does

Given a customer complaint (and optional transaction history), the API returns a structured investigation result:

1. **Matches** the complaint to relevant transaction(s)
2. **Evaluates evidence** (`consistent` / `inconsistent` / `insufficient_data`)
3. **Classifies** the case (`wrong_transfer`, `duplicate_payment`, `phishing_or_social_engineering`, etc.)
4. **Routes** to the correct internal department
5. **Decides** if human review is required
6. **Drafts** `agent_summary`, `recommended_next_action`, and `customer_reply`

> **Core principle:** Business fields (`case_type`, `evidence_verdict`, `department`, `severity`, `human_review_required`, `relevant_transaction_id`) are **always computed by deterministic code**. The LLM only drafts the three prose fields — and only when Groq is configured.

---

## Key features

| Feature | Description |
|---------|-------------|
| **Deterministic investigation engine** | Transaction matching, duplicate detection, evidence evaluation, ambiguity handling |
| **Rule-based classification** | Case type, severity, department, human-review flag, confidence score |
| **Groq integration** | Optional LLM prose via `llama-3.3-70b-versatile` with deadline-aware timeouts |
| **Safe template fallback** | If Groq is down, slow, or returns unsafe text → deterministic safe templates |
| **Prompt-injection defense** | Complaint isolation, delimiter neutralization, injection pattern detection |
| **Output safety scanner** | Blocks PIN/OTP requests, unauthorized refund promises, third-party redirects |
| **Strict validation** | Zod schemas for request/response; 400/422/413 error codes |
| **Performance budgets** | 28s middleware timeout, HTTP keep-alive, stage-level profiling |
| **Bangla support** | Bangla numerals, mixed-language complaints, `reply_language: bn` |
| **279 automated tests** | Unit, integration, adversarial judge pack, load tests |

---

## Architecture

```
POST /analyze-ticket
  │
  ├─► Validation        (Zod — structure, enums, limits)
  ├─► Security          (sanitize complaint for LLM only)
  ├─► Investigation     (matcher → evidence → classifier)  ← deterministic
  ├─► AI prose          (Groq OR safe templates)             ← prose only
  ├─► Response pipeline (sanitize → safety scan → validate)
  └─► JSON response     (snake_case)
```

**Layer layout**

```
src/
  api/           Express routes, controllers, middleware
  services/      Use-case orchestration
  pipelines/     Stage composition (analyze-ticket flow)
  domain/        Investigation + classification engines
  security/      Injection detection, output safety, templates
  ai/            Groq client, prompts, parsers
  validation/    Request/response Zod schemas
```

---

## Tech stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5
- **HTTP:** Express 4
- **Validation:** Zod
- **Logging:** Pino (structured JSON)
- **LLM:** Groq SDK (`llama-3.3-70b-versatile`)
- **Testing:** Vitest + Supertest
- **Container:** Docker multi-stage build (Alpine)

---

## Prerequisites

- [Node.js](https://nodejs.org/) **20 or later**
- [npm](https://www.npmjs.com/) 9+
- (Optional) [Groq API key](https://console.groq.com/) for LLM-generated prose
- (Optional) [Docker](https://www.docker.com/) for containerized deployment

---

## Quick start (local)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/queue-storm-investigator.git
cd queue-storm-investigator
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — minimum for local dev:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
GROQ_API_KEY=your_groq_api_key_here   # optional in dev — uses templates if empty
```

> **Never commit `.env` or your API key to GitHub.**

### 3. Run in development

```bash
npm run dev
```

Server starts at **http://localhost:3000** with hot reload (`tsx watch`).

### 4. Verify

```bash
# Health check
curl http://localhost:3000/health

# Analyze a ticket
curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-001" \
  -d '{
    "ticket_id": "TKT-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today."
  }'
```

### 5. Production build (local)

```bash
npm run build
NODE_ENV=production npm start
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` requires `GROQ_API_KEY` |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Pino log level |
| `GROQ_API_KEY` | — | Groq API key (required in production) |
| `GROQ_BASE_URL` | `https://api.groq.com` | Groq API host only — do **not** include `/openai/v1` (the SDK adds it) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | LLM model for prose |
| `GROQ_PROSE_TIMEOUT_MS` | `12000` | Max time for Groq call |
| `GROQ_PROSE_MAX_TOKENS` | `512` | Max tokens in LLM response |
| `REQUEST_TIMEOUT_MS` | `28000` | Express request deadline (2s under judge 30s) |
| `JSON_BODY_LIMIT` | `1mb` | Max request body size |
| `RATE_LIMIT_ENABLED` | `true` | Per-IP rate limiting |
| `RATE_LIMIT_MAX_REQUESTS` | `600` | Requests per 60s window |
| `CORS_ENABLED` | `true` | CORS middleware |
| `COMPRESSION_ENABLED` | `true` | gzip compression |
| `SAFETY_STRICT_MODE` | `true` | Strict output safety enforcement |

See [`.env.example`](.env.example) for the full list.

---

## API reference

### `GET /health`

Readiness probe for judges and Docker.

**Response `200`**

```json
{ "status": "ok" }
```

**Headers:** `X-Request-Id` echoed or generated.

---

### `POST /analyze-ticket`

Analyze a support ticket and return investigation results.

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Request-Id` | No | Correlation ID (echoed in response/errors) |

**Request body**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `ticket_id` | Yes | string | Unique ticket identifier |
| `complaint` | Yes | string | Customer complaint text |
| `language` | No | enum | `en`, `bn`, `mixed` |
| `channel` | No | enum | `in_app_chat`, `call_center`, `email`, `merchant_portal`, `field_agent` |
| `user_type` | No | enum | `customer`, `merchant`, `agent`, `unknown` |
| `campaign_context` | No | string | Campaign/promo context |
| `transaction_history` | No | array | Up to 50 transactions |
| `metadata` | No | object | Arbitrary metadata (depth-limited) |

**Transaction object**

| Field | Type | Description |
|-------|------|-------------|
| `transaction_id` | string | Unique ID (must be unique within array) |
| `timestamp` | string | ISO 8601 UTC (e.g. `2026-04-14T14:08:22Z`) |
| `type` | enum | `transfer`, `payment`, `cash_in`, `cash_out`, `settlement`, `refund` |
| `amount` | number | Positive number (BDT) |
| `counterparty` | string | Recipient/merchant/agent identifier |
| `status` | enum | `completed`, `failed`, `pending`, `reversed` |

**Response `200`**

| Field | Type | Description |
|-------|------|-------------|
| `ticket_id` | string | Echo of input |
| `relevant_transaction_id` | string \| null | Best-matched transaction |
| `evidence_verdict` | enum | `consistent`, `inconsistent`, `insufficient_data` |
| `case_type` | enum | See [case types](#case-types--routing) |
| `severity` | enum | `low`, `medium`, `high`, `critical` |
| `department` | enum | Routing target |
| `agent_summary` | string | Internal summary for agents |
| `recommended_next_action` | string | Suggested operational step |
| `customer_reply` | string | Safe customer-facing message |
| `human_review_required` | boolean | Escalation flag |
| `confidence` | number? | 0–1 confidence score (optional) |
| `reason_codes` | string[]? | Explainability codes (optional) |

**Error responses**

| Status | Code | When |
|--------|------|------|
| `400` | `VALIDATION_ERROR` | Invalid JSON shape, wrong types, bad enums |
| `400` | `INVALID_JSON` | Malformed JSON body |
| `422` | `SEMANTIC_VALIDATION_ERROR` | Empty/whitespace-only complaint |
| `413` | `PAYLOAD_TOO_LARGE` | Body exceeds size limit |
| `404` | `NOT_FOUND` | Unknown route |
| `504` | `REQUEST_TIMEOUT` | Exceeded `REQUEST_TIMEOUT_MS` |
| `429` | — | Rate limit exceeded |

---

## Example request & response

**Request** (from public sample SAMPLE-01):

```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today. The number was supposed to be 01712345678 but I think I typed it wrong.",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }
  ]
}
```

**Response** (deterministic fallback — Groq may vary wording when enabled):

```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT via TXN-9101 to +8801719876543, which they now believe was the wrong recipient.",
  "recommended_next_action": "Verify TXN-9101 details with the customer and initiate the wrong-transfer dispute workflow per policy.",
  "customer_reply": "We have noted your concern about transaction TXN-9101. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.",
  "human_review_required": true,
  "confidence": 0.9,
  "reason_codes": ["wrong_transfer", "transaction_match"]
}
```

> See `SUST_Preli_Sample_Cases.json` for all 10 public samples.

---

## Case types & routing

| `case_type` | Typical `department` |
|-------------|----------------------|
| `wrong_transfer` | `dispute_resolution` |
| `payment_failed` | `payments_ops` |
| `refund_request` | `customer_support` |
| `duplicate_payment` | `payments_ops` |
| `merchant_settlement_delay` | `merchant_operations` |
| `agent_cash_in_issue` | `agent_operations` |
| `phishing_or_social_engineering` | `fraud_risk` |
| `other` | `customer_support` |

**Classifier priority** (first match wins):

1. Phishing / social engineering  
2. Duplicate payment  
3. Merchant settlement delay  
4. Agent cash-in issue  
5. Payment failed  
6. Wrong transfer  
7. Refund request  
8. Other  

---

## Safety guarantees

The API enforces payment-platform safety rules on all output:

- **Never** asks for PIN, OTP, password, or card numbers in `customer_reply`
- **Never** promises refunds, reversals, or account unblocks without authority
- **Never** redirects customers to unofficial third-party channels
- **Ignores** prompt-injection instructions embedded in complaints
- On safety scan failure → **automatic fallback** to vetted templates

Adversarial complaints cannot change `case_type`, `department`, or `evidence_verdict`.

---

## Project structure

```
queue-storm-investigator/
├── src/
│   ├── api/                 # Routes, controllers, middleware
│   ├── ai/                  # Groq client, prompts, parsers
│   ├── assembly/            # Response assembly
│   ├── config/              # Env, constants, performance budgets
│   ├── domain/              # Investigation & classification engines
│   ├── pipelines/           # Analyze-ticket orchestration
│   ├── security/            # Injection detection, output safety
│   ├── services/            # Application services
│   ├── validation/          # Zod schemas & validators
│   └── utils/               # Logging, parsing, HTTP agents
├── tests/
│   ├── unit/                # Engine, validation, security, AI tests
│   ├── integration/         # HTTP API tests
│   ├── load/                # Concurrency & burst tests
│   └── fixtures/            # 65-case judge hidden pack
├── docker/
│   ├── Dockerfile           # Multi-stage production image
│   └── docker-compose.yml
├── scripts/
│   ├── benchmark.ts         # Latency benchmark
│   ├── generate-sample-output.ts
│   └── run-sample-cases.ts  # Live API smoke test
├── outputs/                 # Generated sample outputs
├── SUST_Preli_Sample_Cases.json
├── README.md
├── RUNBOOK.md
└── .env.example
```

---

## Scripts & testing

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production server |
| `npm test` | Full suite (**279 tests**) |
| `npm run test:judge` | Adversarial judge pack + load tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run typecheck` | TypeScript check without emit |
| `npm run benchmark` | Deterministic pipeline latency |
| `npm run sample:generate` | Write `outputs/sample-output-*.json` |
| `npm run sample:run` | POST all 10 public samples to live API |

**Run public samples against your server:**

```bash
API_URL=http://localhost:3000 npm run sample:run
```

**Generate offline sample outputs (no HTTP):**

```bash
npm run sample:generate
```

---

## Deployment

### Option A — Docker (recommended)

```bash
# From project root — ensure .env exists with GROQ_API_KEY
docker compose -f docker/docker-compose.yml up --build -d

# Verify
curl http://localhost:3000/health
```

Docker image: Node 20 Alpine, non-root user, healthcheck with 60s start period.

### Option B — Direct Node on VPS

```bash
git clone https://github.com/YOUR_USERNAME/queue-storm-investigator.git
cd queue-storm-investigator
npm ci
cp .env.example .env   # edit with production values
npm run build

# Keep running after SSH disconnect
npm install -g pm2
pm2 start dist/index.js --name queue-storm
pm2 save
```

### Production checklist

- [ ] `NODE_ENV=production`
- [ ] `GROQ_API_KEY` set
- [ ] `GET /health` returns 200 from public URL
- [ ] `POST /analyze-ticket` works from public URL
- [ ] Firewall allows port 3000 (or reverse proxy on 80/443)
- [ ] Only one server instance on the port
- [ ] `.env` not committed to git

See [RUNBOOK.md](RUNBOOK.md) for operations, failure modes, and tuning.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `EADDRINUSE :3000` | Another process is using port 3000. Run `netstat -ano \| findstr :3000` (Windows) or `lsof -i :3000` (Linux), kill the PID, restart. |
| `NOT_IMPLEMENTED` response | Stale old server still running — kill it and restart with `npm run dev`. |
| Groq errors / slow responses | App falls back to safe templates; business fields still correct. Check `GROQ_API_KEY` and that `GROQ_BASE_URL` is `https://api.groq.com` (not `.../openai/v1`). |
| `confidence` differs from sample | Normal — sample values are illustrative; business fields matter for scoring. |
| Rate limit 429 during testing | Raise `RATE_LIMIT_MAX_REQUESTS` or set `RATE_LIMIT_ENABLED=false` temporarily. |
| Docker health check failing | Wait up to 60s after container start. |

---

## Hackathon constraints

| Constraint | Limit |
|------------|-------|
| Judge request timeout | **30 seconds** |
| Health readiness (cold start) | **60 seconds** |
| Internal middleware timeout | **28 seconds** (2s buffer) |
| Groq prose timeout | **12 seconds** (configurable) |

---

## Models

| Component | Implementation |
|-----------|----------------|
| Investigation & classification | Deterministic TypeScript engine (no ML) |
| Prose generation | Groq `llama-3.3-70b-versatile` with JSON output |
| Fallback | Rule-based safe templates |

---

## Further reading

| Document | Contents |
|----------|----------|
| [RUNBOOK.md](RUNBOOK.md) | Production ops, failure modes, tuning |
| [tests/JUDGE_EXPECTED_OUTPUTS.md](tests/JUDGE_EXPECTED_OUTPUTS.md) | 65 adversarial test cases documentation |
| [SUST_Preli_Sample_Cases.json](SUST_Preli_Sample_Cases.json) | 10 public sample inputs/outputs |
| [SUST_Hackathon_Preli_Problem_Statement.pdf](SUST_Hackathon_Preli_Problem_Statement.pdf) | Official problem statement |

---

## License

Private — SUST CSE Carnival 2026 Hackathon submission.

---

## Acknowledgments

Built for **QueueStorm Investigator**, SUST CSE Carnival 2026 · Codex Community Hackathon · Online Preliminary Round.
