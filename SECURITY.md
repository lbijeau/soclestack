# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

> **Note**: This project is in active development (pre-1.0). Security patches are applied to the latest version only.

## Reporting a Vulnerability

We take the security of SocleStack seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

**Option 1**: Use [GitHub Security Advisories](https://github.com/lbijeau/soclestack/security/advisories/new) (recommended)

**Option 2**: Open a private security report via GitHub's "Report a vulnerability" button

Include the following information:

1. **Description**: A clear description of the vulnerability
2. **Steps to Reproduce**: Detailed steps to reproduce the issue
3. **Impact**: What an attacker could achieve by exploiting this vulnerability
4. **Affected Components**: Which parts of the codebase are affected
5. **Suggested Fix**: If you have one (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Updates**: We will keep you informed of our progress toward a fix
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### Safe Harbor

We consider security research conducted under this policy to be:

- Authorized concerning any applicable anti-hacking laws
- Authorized concerning any relevant anti-circumvention laws
- Exempt from restrictions in our Terms of Service that would interfere with security research

We will not pursue civil action or initiate a complaint to law enforcement for security research conducted in accordance with this policy.

## Security Best Practices

When deploying SocleStack, we recommend:

### Environment Variables

- Never commit `.env` files to version control
- Use strong, unique values for `SESSION_SECRET`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`
- Rotate secrets periodically

### Database

- Use SSL/TLS connections for PostgreSQL in production
- Restrict database access to application servers only
- Use connection pooling to prevent connection exhaustion

### Rate Limiting

- Configure Redis-based rate limiting for production deployments
- Consider Cloudflare or similar edge protection for DDoS mitigation
- See `docs/deployment/cloudflare-setup.md` for recommended configuration

### Authentication

- Enable 2FA for admin accounts (enforced by default)
- Configure account lockout thresholds appropriately
- Monitor audit logs for suspicious activity

## Security Features

SocleStack includes the following security features:

- **Password Security**: bcrypt hashing with configurable salt rounds
- **Session Management**: iron-session with secure httpOnly cookies
- **Rate Limiting**: Configurable limits on auth endpoints (memory or Redis backend)
- **Account Lockout**: Automatic lockout after failed login attempts
- **2FA**: TOTP-based two-factor authentication with backup codes
- **Audit Logging**: Comprehensive logging of security events
- **CSRF Protection**: Double-submit cookie pattern
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more

## Vulnerability Disclosure Timeline

1. **Day 0**: Vulnerability reported
2. **Day 2**: Acknowledgment sent to reporter
3. **Day 5**: Initial assessment completed
4. **Day 7-30**: Fix developed and tested
5. **Day 30**: Patch released (or earlier for critical issues)
6. **Day 37**: Public disclosure (after patch is available)

We may adjust this timeline based on the severity and complexity of the vulnerability.

## Recognition

We appreciate security researchers who help keep SocleStack safe. With your permission, we will acknowledge your contribution in:

- Our security advisories
- Release notes
- A dedicated security acknowledgments page (coming soon)

Thank you for helping keep SocleStack and our users safe!
