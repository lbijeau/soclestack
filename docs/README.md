# SocleStack Documentation

Welcome to the SocleStack documentation. This guide helps you navigate the available resources.

## Quick Links

| I want to... | Go to |
|--------------|-------|
| Get started quickly | [Progress & Overview](./PROGRESS.md) |
| Understand the architecture | [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) |
| Set up my environment | [Environment Variables](./ENVIRONMENT.md) |
| Learn about the database | [Database Schema](./DATABASE.md) |
| Use the API | [API Examples](./API_EXAMPLES.md) |
| Deploy to production | [Deployment Guide](./deployment/cloudflare-setup.md) |
| Run tests | [Testing Guide](./testing/README.md) |
| Fix a problem | [Troubleshooting](./TROUBLESHOOTING.md) |

## Documentation Structure

```
docs/
├── README.md                 # You are here
├── PROGRESS.md               # Project status and feature overview
├── TECHNICAL_ARCHITECTURE.md # System design and patterns
├── DATABASE.md               # Schema and data models
├── MIGRATIONS.md             # Database migration guide
├── ENVIRONMENT.md            # Configuration reference
├── API_REFERENCE.md          # API endpoints overview
├── API_EXAMPLES.md           # Practical API usage examples
├── TROUBLESHOOTING.md        # Common issues and solutions
├── DOCUMENTATION_STATUS.md   # Documentation health metrics
│
├── deployment/               # Production deployment guides
│   └── cloudflare-setup.md   # Cloudflare WAF & rate limiting
│
├── testing/                  # Testing documentation
│   ├── README.md             # Testing overview
│   └── TEST-STRATEGY.md      # Testing approach
│
├── templates/                # Documentation templates
│   └── COMPONENT_README_TEMPLATE.md  # Standard component README format
│
└── plans/                    # Design documents (historical)
    └── *.md                  # Feature design specs
```

## Core Documentation

### [Progress & Overview](./PROGRESS.md)
Current project status, completed features, and file structure reference. Start here to understand what SocleStack provides.

**Covers:** All 13 implementation phases, feature list, configuration reference, available commands.

### [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)
Deep dive into system design, patterns, and implementation details.

**Covers:**
- Authentication strategy (JWT, sessions, OAuth)
- Database schema design
- API route structure
- Security considerations
- Rate limiting architecture
- Structured logging
- Service layer patterns

### [Database Schema](./DATABASE.md)
Complete database documentation including all tables, relationships, and migrations.

**Covers:** Users, sessions, organizations, OAuth accounts, API keys, audit logs.

**See also:** [Migrations Guide](./MIGRATIONS.md) - How to create and apply schema changes.

### [Environment Variables](./ENVIRONMENT.md)
All configuration options with descriptions and examples.

**Covers:**
- Required vs optional variables
- Database configuration (SQLite/PostgreSQL)
- Authentication secrets
- OAuth provider setup
- Redis rate limiting
- Email service configuration

### [API Reference](./API_REFERENCE.md)
Overview of available API endpoints and their purposes.

### [API Examples](./API_EXAMPLES.md)
Practical, copy-paste ready examples for all major endpoints.

**Covers:**
- Authentication flows (login, 2FA, token refresh)
- User management (profile updates, password changes)
- API key creation and usage
- Organization management and invites
- Error handling patterns
- TypeScript type definitions

## Deployment

### [Cloudflare Setup](./deployment/cloudflare-setup.md)
Production deployment guide with Cloudflare WAF and rate limiting configuration.

**Covers:**
- Rate limiting rules for auth endpoints
- WAF configuration
- Security headers
- DDoS protection

## Testing

### [Testing Guide](./testing/README.md)
How to run and write tests for SocleStack.

### [Test Strategy](./testing/TEST-STRATEGY.md)
Testing philosophy and coverage approach.

**Commands:**
```bash
npm run test:unit    # 306 unit tests
npm run test:e2e     # End-to-end tests
```

## Templates

### [Documentation Templates](./templates/README.md)
Standardized templates for creating consistent documentation across the project.

**Available templates:**
- [Component README Template](./templates/COMPONENT_README_TEMPLATE.md) - Standard format for component directory READMEs

## Design Documents

The `plans/` directory contains historical design documents for major features. These are useful for understanding design decisions but may not reflect the current implementation exactly.

Key designs:
- `two-factor-auth-design.md` - TOTP 2FA implementation
- `oauth-social-login-design.md` - Google/GitHub OAuth
- `organizations-design.md` - Multi-tenancy architecture
- `api-keys-design.md` - Programmatic access

## Related Files

These files live in the repository root:

| File | Purpose |
|------|---------|
| [README.md](../README.md) | Project introduction |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](../SECURITY.md) | Security policy |
| [CLAUDE.md](../CLAUDE.md) | AI agent instructions |

## Source Code Documentation

Component and library documentation lives alongside the code:

```
src/
├── components/
│   ├── auth/README.md        # Auth components
│   ├── admin/README.md       # Admin components
│   ├── profile/README.md     # Profile components
│   └── ui/README.md          # UI primitives
├── lib/
│   └── README.md             # Core utilities
├── app/api/
│   └── */README.md           # API route docs
└── types/
    └── README.md             # Type definitions
```

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/lbijeau/soclestack/issues)
- **Security:** See [SECURITY.md](../SECURITY.md)
- **Contributing:** See [CONTRIBUTING.md](../CONTRIBUTING.md)
