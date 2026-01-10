# SocleStack - Next.js User Management Application

<div align="center">
  <img src="./public/images/logo.svg" alt="SocleStack Logo" width="200" />
  <br />
</div>

[![Status](https://img.shields.io/badge/status-beta-yellow)](#production-checklist)
[![LLM-Ready](https://img.shields.io/badge/LLM--Ready-Claude%20%7C%20Cursor%20%7C%20Copilot-blue)](#llm-assisted-development)
[![Docs](https://img.shields.io/badge/docs-VitePress-646cff)](https://lbijeau.github.io/soclestack/)

**[View Full Documentation](https://lbijeau.github.io/soclestack/)**

![SocleStack Banner](./public/images/social-preview.png)

A complete Next.js 15 application with enterprise-grade user management features, built with TypeScript, Prisma, and modern React components. **SocleStack** is the foundational block upon which your SaaS application is built.

## Why SocleStack?

**Skip weeks of boilerplate.** Auth, roles, organizations, API keys, audit logs — it's all here. Clone, configure, and start building your actual product.

**Optimized for LLM-assisted development.** Clean architecture, consistent patterns, and comprehensive documentation make this codebase ideal for AI coding tools like Claude Code, Cursor, and GitHub Copilot. The AI understands the patterns and can extend them reliably.

> **Note**
> Review the [Production Checklist](#production-checklist) before deploying. Core security is implemented; configuration is required for your environment.

## Features

- **Complete Authentication** - Registration, login, email verification, password reset, 2FA
- **Role-Based Access Control** - Hierarchical roles with database-driven permissions
- **Multi-Tenancy** - Organization-based data isolation with invite system
- **OAuth Integration** - Google and GitHub social login
- **API Keys** - Token-based API authentication with scoped permissions
- **Audit Logging** - Comprehensive security event tracking
- **Session Management** - Timeout warnings with extend capability
- **SDK Packages** - Headless core SDK and React components for integration
- **Modern UI** - Responsive Tailwind CSS design with admin panel

## Tech Stack

Next.js 15 (App Router) | TypeScript | PostgreSQL + Prisma | Tailwind CSS | iron-session + JWT

## SDK Packages

Build custom frontends or integrate SocleStack auth into existing apps:

| Package | Description |
|---------|-------------|
| [`@soclestack/core`](packages/core) | Headless SDK - framework-agnostic auth client |
| [`@soclestack/react`](packages/react) | React hooks and components for auth flows |

```bash
npm install @soclestack/core @soclestack/react
```

See the [SDK Recipes Guide](https://lbijeau.github.io/soclestack/SDK_RECIPES) for copy-paste patterns.

## Quick Start

```bash
# Clone and install
git clone https://github.com/lbijeau/soclestack.git
cd soclestack && npm install

# Start PostgreSQL
docker-compose up -d

# Setup environment and database
cp .env.example .env.local
npx prisma generate && npx prisma db push

# Run
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Documentation

**Full documentation: [lbijeau.github.io/soclestack](https://lbijeau.github.io/soclestack/)**

| Document | Description |
|----------|-------------|
| [API Reference](https://lbijeau.github.io/soclestack/API_REFERENCE) | Complete API endpoint documentation |
| [Technical Architecture](https://lbijeau.github.io/soclestack/TECHNICAL_ARCHITECTURE) | Project structure, security, and design |
| [SDK Recipes](https://lbijeau.github.io/soclestack/SDK_RECIPES) | Copy-paste patterns for auth flows |
| [Component Catalog](https://lbijeau.github.io/soclestack/components/catalog) | UI and SDK component reference |
| [Database Schema](https://lbijeau.github.io/soclestack/DATABASE) | Models, relationships, and queries |
| [Environment Variables](https://lbijeau.github.io/soclestack/ENVIRONMENT) | Configuration reference |

## Production Checklist

### Security Status

| Feature | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ Ready | Double-submit cookie pattern with middleware validation |
| Secrets Validation | ✅ Ready | Zod validates all secrets at startup |
| Rate Limiting | ✅ Ready | In-memory default; Redis recommended for multi-instance |
| CSP Policy | ⚠️ Partial | Scripts use nonces; styles use `unsafe-inline` |

### Before Deploying

- [ ] PostgreSQL configured and migrated
- [ ] Environment variables set (validated by Zod on startup)
- [ ] Email service configured (`RESEND_API_KEY` — logs only in dev)
- [ ] Redis for rate limiting (`UPSTASH_REDIS_REST_URL` — optional but recommended)
- [ ] HTTPS enabled with proper security headers

See [Technical Architecture](https://lbijeau.github.io/soclestack/TECHNICAL_ARCHITECTURE) for full security considerations.

## LLM-Assisted Development

SocleStack is designed to be extended by AI coding assistants. The codebase follows consistent patterns that LLMs can learn and replicate:

- **Consistent file structure** — API routes, components, and services follow predictable conventions
- **TypeScript throughout** — Strong typing helps AI understand data shapes and catch errors
- **Zod validation schemas** — Self-documenting request/response contracts
- **Comprehensive CLAUDE.md** — Project-specific instructions for Claude Code and similar tools
- **Detailed documentation** — Architecture docs give AI the context it needs

**Recommended workflow:** Describe what you want to build, let the AI scaffold it following existing patterns, then review and refine.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
