# Distributed Rate Limiting Evaluation

**Issue:** #17
**Date:** 2026-01-03
**Status:** Evaluation Complete

## Executive Summary

After evaluating the options, we recommend a **tiered approach**:
1. **Edge-level protection** via Cloudflare (for DDoS and IP-based abuse)
2. **Keep in-memory rate limiting** for single-instance deployments
3. **Optional Upstash Redis** only when horizontal scaling is needed

The current in-memory implementation is sufficient for most deployments. Edge protection handles the majority of abuse cases without application changes.

---

## Current Implementation

### Rate-Limited Operations

| Operation | Limit | Window | Identifier |
|-----------|-------|--------|------------|
| Login attempts | 5 failures | 15 min | IP |
| Registration | 3 | 1 hour | IP |
| Password reset | 5 | 1 hour | IP |
| 2FA setup/disable | 5 | 1 hour | User |
| API key operations | 10 | 1 hour | User |
| CSRF failures | 10 | 5 min | IP |

### Current Architecture

```
src/lib/auth.ts:445-466

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  // Simple in-memory sliding window
}
```

**Limitations:**
- State lost on server restart
- Not shared across multiple instances
- Memory grows unbounded (no cleanup)

---

## Option 1: Cloudflare WAF / Rate Limiting

### Overview
Handle IP-based rate limiting at the edge before requests reach the application.

### Capabilities
- **Rate Limiting Rules**: Configure limits per endpoint, IP, country
- **Bot Management**: Block known bad actors automatically
- **DDoS Protection**: Absorbs volumetric attacks
- **WAF Rules**: Block common attack patterns (SQLi, XSS)

### Configuration Example
```
Rule: Login Rate Limit
When: URI Path equals "/api/auth/login"
And: Request Method equals "POST"
Then: Rate limit to 10 requests per minute per IP
Action: Challenge (CAPTCHA) or Block
```

### Pros
- Zero application code changes
- Handles abuse before it reaches your servers
- Built-in analytics and logging
- Covers 80%+ of abuse cases
- Free tier includes basic rate limiting

### Cons
- Requires Cloudflare DNS integration
- Limited visibility into user-level limits
- Cannot rate limit authenticated users by user ID
- Additional cost for advanced features ($20+/month)

### Verdict: **Recommended for IP-based protection**

---

## Option 2: Vercel Edge Middleware + KV

### Overview
Rate limit at Vercel's edge using their KV store for distributed state.

### Implementation Sketch
```typescript
// middleware.ts
import { kv } from '@vercel/kv';

export async function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const key = `ratelimit:${ip}:login`;

  const current = await kv.incr(key);
  if (current === 1) {
    await kv.expire(key, 60); // 1 minute window
  }

  if (current > 10) {
    return new Response('Too Many Requests', { status: 429 });
  }
}
```

### Pros
- Native Vercel integration
- Low latency (edge execution)
- Simple API

### Cons
- Vercel-specific (vendor lock-in)
- KV costs: $1/100K reads, $1/100K writes
- At 1M requests/month: ~$20/month just for rate limiting
- Adds latency to every request (KV read)

### Verdict: **Not recommended** - Cloudflare is more cost-effective

---

## Option 3: Redis / Upstash

### Overview
Application-level distributed rate limiting using serverless Redis.

### Implementation Options

**A) Upstash Rate Limit SDK**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

// In route handler
const { success } = await ratelimit.limit(identifier);
```

**B) Direct Redis Commands**
```typescript
const key = `ratelimit:${userId}:action`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 3600);
if (count > limit) return rateLimitedResponse();
```

### Upstash Pricing
- Free tier: 10K commands/day
- Pay-as-you-go: $0.2 per 100K commands
- Pro: $10/month for 100K commands/day

### Pros
- True distributed state
- Per-user rate limiting across instances
- Works with any deployment platform
- Sub-millisecond latency

### Cons
- Additional infrastructure dependency
- Adds latency to rate-limited operations
- Overkill for single-instance deployments
- Requires code changes

### Verdict: **Recommended only when scaling horizontally**

---

## Option 4: Keep In-Memory

### Overview
Continue using the current Map-based implementation.

### Improvements Needed
```typescript
// Add periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute
```

### Pros
- Zero additional dependencies
- Zero additional cost
- Fastest possible (no network calls)
- Simple to understand and debug

### Cons
- State lost on restart
- Not shared across instances
- Requires memory cleanup

### Verdict: **Sufficient for single-instance deployments**

---

## Recommendation

### Deployment Scenarios

| Scenario | Recommendation |
|----------|---------------|
| Single instance (Vercel Hobby) | Keep in-memory + Cloudflare free tier |
| Multiple instances | In-memory + Cloudflare + Upstash for user limits |
| High-security requirements | Cloudflare Pro + Upstash |

### Implementation Plan

**Phase 1: Quick Wins (No code changes)**
1. Enable Cloudflare free rate limiting for:
   - `/api/auth/login` - 10 req/min per IP
   - `/api/auth/register` - 3 req/hour per IP
   - `/api/auth/forgot-password` - 5 req/hour per IP

**Phase 2: Code Cleanup**
1. Add memory cleanup to existing rate limiter
2. Add rate limit headers to responses (`X-RateLimit-*`)

**Phase 3: If Scaling Needed**
1. Add Upstash Redis
2. Create abstraction layer: `RateLimiter` interface
3. Implement `MemoryRateLimiter` and `RedisRateLimiter`
4. Configure via environment variable

### Abstraction Layer Design

```typescript
// src/lib/rate-limiter/types.ts
export interface RateLimiter {
  isLimited(key: string, limit: number, windowMs: number): Promise<boolean>;
  getRemainingAttempts(key: string, limit: number): Promise<number>;
}

// src/lib/rate-limiter/memory.ts
export class MemoryRateLimiter implements RateLimiter { ... }

// src/lib/rate-limiter/redis.ts
export class RedisRateLimiter implements RateLimiter { ... }

// src/lib/rate-limiter/index.ts
export const rateLimiter: RateLimiter =
  process.env.REDIS_URL
    ? new RedisRateLimiter()
    : new MemoryRateLimiter();
```

---

## Cost Comparison

| Solution | Monthly Cost | Setup Effort |
|----------|--------------|--------------|
| In-memory only | $0 | None |
| Cloudflare Free | $0 | 1 hour |
| Cloudflare Pro | $20 | 1 hour |
| Upstash (pay-as-go) | ~$2-10 | 2-4 hours |
| Vercel KV | ~$20+ | 2-4 hours |

---

## Decision

**For SocleStack starter kit:**

1. **Document Cloudflare setup** in deployment guide
2. **Add memory cleanup** to current implementation
3. **Add rate limit headers** for client visibility
4. **Prepare abstraction** for future Redis support
5. **Close issue #17** with this evaluation

The current implementation is production-ready for single-instance deployments when combined with Cloudflare edge protection.
