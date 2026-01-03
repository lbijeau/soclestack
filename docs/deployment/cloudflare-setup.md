# Cloudflare Edge Rate Limiting Setup

This guide covers configuring Cloudflare WAF rate limiting to protect authentication endpoints at the edge, before requests reach your application.

## Architecture Overview

```
User → Cloudflare Edge → Rate Limiting Rules → Application (Pass/Block)
```

Edge-level rate limiting provides:
- **Early rejection** - Blocked requests never reach your infrastructure
- **DDoS protection** - Cloudflare absorbs attack traffic
- **Global distribution** - Rules enforced at 300+ edge locations
- **No application code** - Configuration-only security layer

## Prerequisites

- Domain registered and active
- Cloudflare account (Free tier works for basic rate limiting)
- Access to domain registrar for nameserver changes

## Step 1: Add Domain to Cloudflare

1. Log in to Cloudflare Dashboard
2. Click **Add a Site**
3. Enter your domain name
4. Select a plan (Free tier includes basic rate limiting)
5. Cloudflare will scan existing DNS records

### Update Nameservers

After adding your domain, Cloudflare provides nameserver addresses:

```
ns1.cloudflare.com
ns2.cloudflare.com
```

Update these at your domain registrar. Propagation typically takes 24-48 hours.

### Verify Configuration

1. In Cloudflare Dashboard, check domain status shows **Active**
2. Verify DNS records are proxied (orange cloud icon)
3. Test with: `dig +short your-domain.com`

## Step 2: Configure Rate Limiting Rules

Navigate to **Security → WAF → Rate limiting rules**.

### Rule 1: Login Protection

Protects `/api/auth/login` from brute force attacks.

| Setting | Value |
|---------|-------|
| **Rule name** | Login Rate Limit |
| **Expression** | `(http.request.uri.path eq "/api/auth/login" and http.request.method eq "POST")` |
| **Characteristics** | IP |
| **Requests** | 10 |
| **Period** | 1 minute |
| **Action** | Managed Challenge |

**Rationale**: 10 requests/minute allows legitimate users multiple attempts while blocking automated attacks. Managed Challenge presents a CAPTCHA rather than hard blocking.

### Rule 2: Registration Protection

Prevents mass account creation.

| Setting | Value |
|---------|-------|
| **Rule name** | Registration Rate Limit |
| **Expression** | `(http.request.uri.path eq "/api/auth/register" and http.request.method eq "POST")` |
| **Characteristics** | IP |
| **Requests** | 3 |
| **Period** | 1 hour |
| **Action** | Block |

**Rationale**: Legitimate users rarely need more than 3 registration attempts per hour. Hard block prevents bot registrations.

### Rule 3: Password Reset Request Protection

Prevents email enumeration and spam on forgot-password requests.

| Setting | Value |
|---------|-------|
| **Rule name** | Password Reset Request Rate Limit |
| **Expression** | `(http.request.uri.path eq "/api/auth/forgot-password" and http.request.method eq "POST")` |
| **Characteristics** | IP |
| **Requests** | 5 |
| **Period** | 1 hour |
| **Action** | Block |

### Rule 4: Password Reset Submission Protection

Prevents brute-force token guessing on password reset submissions.

| Setting | Value |
|---------|-------|
| **Rule name** | Password Reset Submission Rate Limit |
| **Expression** | `(http.request.uri.path eq "/api/auth/reset-password" and http.request.method eq "POST")` |
| **Characteristics** | IP |
| **Requests** | 10 |
| **Period** | 1 hour |
| **Action** | Block |

**Rationale**: Limits attempts to submit new passwords with reset tokens, preventing token brute-forcing.

### Rule 5: Email Verification Resend

Prevents verification email spam.

| Setting | Value |
|---------|-------|
| **Rule name** | Verification Resend Rate Limit |
| **Expression** | `(http.request.uri.path eq "/api/auth/resend-verification" and http.request.method eq "POST")` |
| **Characteristics** | IP |
| **Requests** | 3 |
| **Period** | 1 hour |
| **Action** | Block |

### Rule 6: Account Unlock Protection

Prevents unlock request abuse.

| Setting | Value |
|---------|-------|
| **Rule name** | Account Unlock Rate Limit |
| **Expression** | `(http.request.uri.path eq "/api/auth/request-unlock" and http.request.method eq "POST")` |
| **Characteristics** | IP |
| **Requests** | 3 |
| **Period** | 1 hour |
| **Action** | Block |

## Step 3: Configure WAF Settings

### Enable Managed Rulesets

Navigate to **Security → WAF → Managed rules**:

1. Enable **Cloudflare Managed Ruleset** (OWASP Core Rule Set)
2. Enable **Cloudflare OWASP Core Ruleset**
3. Set sensitivity to **Medium** (adjust based on false positive rate)

### Bot Fight Mode

Navigate to **Security → Bots**:

1. Enable **Bot Fight Mode** (Free tier)
2. Or configure **Super Bot Fight Mode** (Pro tier) for more control

### Security Level

Navigate to **Security → Settings**:

- **Security Level**: Medium
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: On

## Step 4: Test Configuration

### Verify Rate Limiting

Use curl to test rate limiting (replace with your domain):

```bash
# Test login rate limit (should trigger after 10 requests)
for i in {1..15}; do
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    -w "Request $i: %{http_code}\n" -o /dev/null -s
  sleep 0.5
done
```

Expected behavior:
- Requests 1-10: Normal response (401 or 200)
- Requests 11+: 403 or Cloudflare challenge page

### Check Cloudflare Analytics

Navigate to **Security → Overview** to see:
- Blocked requests
- Rate limiting triggers
- Challenge solve rates

## Troubleshooting

### Requests Not Being Rate Limited

1. **Check proxy status**: Ensure DNS record shows orange cloud (proxied)
2. **Verify rule expression**: Test with Cloudflare Expression Builder
3. **Check rule order**: Rules are evaluated in order; ensure no early pass

### Legitimate Users Being Blocked

1. **Check IP**: Shared IPs (corporate NAT, VPN) may hit limits faster
2. **Adjust limits**: Increase request count or use Managed Challenge instead of Block
3. **Add bypass rules**: Create rules for known-good IPs or authenticated users

### Challenge Loop

If users get stuck in challenge loops:

1. Check **Challenge Passage** setting (increase if too short)
2. Verify JavaScript is enabled on client
3. Check for browser extensions blocking Cloudflare scripts

## Monitoring and Alerts

### Set Up Notifications

Navigate to **Notifications** and configure alerts for:

- Rate limiting rule triggers
- Security events
- DDoS attack notifications

### Review Logs

Use **Security → Events** to:

- Review blocked requests
- Identify attack patterns
- Tune rule sensitivity

## Cost Considerations

| Plan | Rate Limiting Features |
|------|----------------------|
| Free | Basic rate limiting (simple rules) |
| Pro | Advanced rate limiting, more rules |
| Business | Complex expressions, custom responses |
| Enterprise | Unlimited rules, advanced analytics |

For most applications, the Free or Pro tier provides sufficient protection.

## Integration with Application Rate Limiting

Cloudflare rate limiting works alongside your application-level rate limiting:

```
Request Flow:
1. Cloudflare Edge: Coarse-grained, IP-based limiting
2. Application: Fine-grained, user-based limiting

Cloudflare handles: Volume attacks, bot traffic, IP-based abuse
Application handles: Per-user limits, business logic limits
```

Both layers are recommended for defense in depth.

## Related Documentation

- [Rate Limiter Abstraction Layer](../plans/2026-01-03-distributed-rate-limiting-evaluation.md)
- [Security Configuration](../ENVIRONMENT.md)

## References

- [Cloudflare Rate Limiting Documentation](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare WAF Managed Rulesets](https://developers.cloudflare.com/waf/managed-rules/)
- [Expression Builder Reference](https://developers.cloudflare.com/ruleset-engine/rules-language/)
