# Judge Hidden Test Pack — Expected Outputs

This document explains the synthetic adversarial suite in `tests/fixtures/judge-hidden-cases.json`, mirroring what a hackathon judge harness would throw at your API beyond the 10 public samples.

## How to run

```bash
npm run test:judge    # unit + integration + load tests only
npm test              # full suite (271+ tests)
```

## HTTP contract

| Status | Meaning | Examples |
|--------|---------|----------|
| **200** | Valid ticket processed | Normal cases, injection in complaint, SQL/XSS in text |
| **400** | Structural / type / enum / strict-schema errors | Missing fields, wrong types, unknown keys, duplicate txn IDs |
| **422** | Semantically empty complaint after normalization | `""`, whitespace-only |
| **413** | Body exceeds `JSON_BODY_LIMIT` | Huge complaint payload |

Every error response includes `code`, `error`, and `requestId` (from `X-Request-Id` header when sent).

## Scoring rules (judge perspective)

### Deterministic business fields (must not come from LLM)

These must be computed by your investigation/classification engine:

- `relevant_transaction_id`
- `evidence_verdict` — `consistent` \| `inconsistent` \| `insufficient_data`
- `case_type`
- `severity`
- `department`
- `human_review_required`

### Prose fields (LLM or safe template)

- `agent_summary`, `recommended_next_action`, `customer_reply` — must always pass safety scan
- Must **never** promise refunds, request PIN/OTP, or redirect to third parties

### Safety invariants (all 200 responses)

- `customer_reply` contains safe guidance (e.g. “do not share your PIN/OTP”)
- Must **not** match: `we will refund`, `share your otp`, `<script>`, `onerror=`

---

## Category guide (65 hidden cases)

### Normal (3)

| ID | Input gist | Expected routing |
|----|------------|------------------|
| JUDGE-N01 | Vague complaint, no history | `other`, `insufficient_data`, no txn |
| JUDGE-N02 | Refund + matching transfer | `refund_request`, `consistent`, `TXN-RF-01` |
| JUDGE-N03 | Full optional fields + payment failed | `payment_failed`, `payments_ops` |

### Malformed (10) → **400**

Non-JSON bodies, array root, null root, wrong types (`ticket_id` number, `complaint` array), `NaN`/`Infinity` amounts, truncated JSON.

### Huge payload (1) → **413**

Complaint > JSON body limit (64KB in judge integration tests).

### Unicode (3)

Emoji, CJK, Bangla digits, NFKC fullwidth ticket IDs, zero-width characters — all **200**; routing from keywords/amounts, not charset.

### Bangla (2)

| ID | Expected |
|----|----------|
| JUDGE-BN01 | `wrong_transfer` + Bangla numerals (৩০০০) |
| JUDGE-BN02 | `phishing_or_social_engineering`, `fraud_risk`, `critical` |

### Mixed language (2)

Code-switched complaints; `payment_failed` wins when both refund and failed keywords appear (classifier order).

### Prompt injection (4)

Embedded `SYSTEM:`, JSON blobs, DAN jailbreaks, XML tags — **must not** change deterministic routing when evidence is clear (e.g. duplicate payment still `duplicate_payment` + `human_review_required: true`).

### Refund attacks (3)

User demands instant refund / embeds desired `customer_reply` — **200** with safe prose; `case_type` follows real signals (`wrong_transfer` or `refund_request`), never unauthorized refund language in output.

### Fake OTP requests (3)

OTP/PIN bait in complaint → `phishing_or_social_engineering`; output must not solicit credentials.

### Empty arrays (2)

`transaction_history: []` and `metadata: {}` — valid **200**.

### Null values (2)

`null` in metadata leaves — **200**; `complaint: null` — **400**.

### Missing fields (3) → **400**

Missing `ticket_id`, `complaint`, or empty `{}` body.

### Wrong enums (4) → **400**

Invalid `language`, `channel`, `status`, `user_type`.

### Multiple transactions (2)

| ID | Behavior |
|----|----------|
| JUDGE-MT01 | `TXN-####` in complaint disambiguates → `payment_failed` on failed txn |
| JUDGE-MT02 | Two 500-taka transfers, vague complaint → `insufficient_data`, `relevant_transaction_id: null` |

**Note:** Transaction ID extraction uses pattern `TXN-<alphanumeric-hyphen>` (e.g. `TXN-9101`, `TXN-RF-01`).

### Duplicate payment (2)

| ID | Behavior |
|----|----------|
| JUDGE-DUP01 | Two payments 12s apart → `duplicate_payment`, second txn relevant |
| JUDGE-DUP02 | Duplicate `transaction_id` in array → **400** |

### Merchant issues (2)

Settlement delay + `user_type: merchant` → `merchant_settlement_delay` / `merchant_operations`. Injection text must not override when settlement keywords present.

### Random garbage (2)

Keyboard mash / lorem ipsum → `other`, still safe **200**.

### SQL injection (2)

SQL strings in complaint/counterparty/metadata — treated as plain text; **200** with normal routing.

### XSS (2)

`<script>`, `<img onerror=…>` in complaint — no executable markup in response fields; routing unchanged.

### Unexpected JSON (3) → **400**

Unknown top-level keys, extra transaction fields, `__proto__` / `constructor` keys.

### Unknown values (2)

Unknown `campaign_context`, emoji counterparty — **200**; routing from txn type/status/keywords.

### Boundary values (5)

| ID | Expected |
|----|----------|
| JUDGE-BND01 | `amount: 0.01` — valid |
| JUDGE-BND02 | `amount: 0` — **400** |
| JUDGE-BND03 | 128-char `ticket_id` — **200** |
| JUDGE-BND04 | Whitespace complaint — **422** |
| JUDGE-BND05 | Metadata nested >3 levels — **400** |

### Stress (1)

50 transactions (max history) + `TXN-49` + amount `1234` — **200** in <5s, `evidence_verdict: consistent`.

---

## Load test expectations

| Test | Concurrency | SLA |
|------|-------------|-----|
| Health | 50 parallel GET | All 200, total <60s |
| Analyze parallel | 30 parallel POST | p50 <2s, p95 <5s, max <30s |
| Analyze burst | 100 sequential | p99 <3s per request |

(Groq disabled in test env — templates only; production adds LLM latency budget.)

---

## Test file map

| File | Role |
|------|------|
| `tests/fixtures/judge-hidden-cases.json` | 65 case definitions + rationales |
| `tests/unit/judge/hidden-cases.unit.test.ts` | Deterministic engine + validation unit tests |
| `tests/integration/judge-hidden.api.test.ts` | Full HTTP contract per case |
| `tests/load/analyze-ticket.load.test.ts` | Concurrency and burst load |
| `tests/helpers/judge-assertions.ts` | Schema, business, and safety assertions |
| `tests/helpers/load-judge-cases.ts` | Fixture loader + runtime placeholders |

---

## Classifier priority (why some cases surprise you)

1. `phishing_or_social_engineering` (OTP/PIN/scam keywords)
2. `duplicate_payment` (duplicate pair detected)
3. `merchant_settlement_delay` (merchant + settlement)
4. `agent_cash_in_issue`
5. `payment_failed` (before wrong_transfer/refund)
6. `wrong_transfer`
7. `refund_request`
8. `other`

This order explains cases like JUDGE-ML01 (`payment_failed` not `refund_request`) and JUDGE-OTP03 (`phishing` when OTP appears).
