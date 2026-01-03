# Contributing to SocleStack

Thank you for considering contributing to SocleStack! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/soclestack.git
   cd soclestack
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

5. Set up the database:
   ```bash
   npx prisma db push
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

### Running Tests

```bash
# Unit tests (306 tests)
npm run test:unit

# E2E tests
npm run test:e2e

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When filing a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Environment details (OS, Node version, browser)
- Relevant error messages or screenshots

### Suggesting Features

Feature requests are welcome! Please include:

- A clear description of the feature
- The problem it solves
- Possible implementation approaches
- Any relevant examples from other projects

### Pull Requests

1. **Create a branch** from `master`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following our code standards

3. **Write tests** for new functionality

4. **Ensure all checks pass**:
   ```bash
   npm run lint
   npm run test:unit
   npx tsc --noEmit
   ```

5. **Commit your changes** using conventional commits (see below)

6. **Push and create a PR** against `master`

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode compliance
- Define explicit types (avoid `any`)
- Use Zod for runtime validation

### Code Style

- ESLint and Prettier are enforced via pre-commit hooks
- Run `npm run lint` to check for issues
- Run `npm run format` to auto-format code

### File Organization

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components
├── lib/           # Utility functions and core logic
├── services/      # Business logic layer
├── contexts/      # React contexts
└── types/         # TypeScript type definitions
```

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/). Commits are validated by commitlint.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                          |
|------------|--------------------------------------|
| `feat`     | New feature                          |
| `fix`      | Bug fix                              |
| `docs`     | Documentation changes                |
| `style`    | Code style (formatting, etc.)        |
| `refactor` | Code refactoring                     |
| `perf`     | Performance improvements             |
| `test`     | Adding or updating tests             |
| `build`    | Build system changes                 |
| `ci`       | CI/CD changes                        |
| `chore`    | Other changes (dependencies, etc.)   |
| `revert`   | Revert a previous commit             |

### Examples

```bash
feat(auth): add password reset functionality
fix(session): resolve token refresh race condition
docs: update API documentation
test(auth): add unit tests for lockout mechanism
```

## Branch Naming

Use descriptive branch names with prefixes:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

Examples:
- `feat/oauth-github-integration`
- `fix/session-expiry-bug`
- `docs/api-examples`

## Documentation

- Update documentation for any user-facing changes
- Add JSDoc comments for exported functions
- Update README.md if adding new features
- Use Mermaid diagrams for architecture changes

### Documentation Commands

```bash
# Build documentation site
npm run docs:build

# Preview documentation
npm run docs:dev
```

## Security

For security vulnerabilities, please see our [Security Policy](SECURITY.md). Do not report security issues through public GitHub issues.

## Review Process

1. All PRs require at least one approval
2. CI checks must pass (lint, tests, type-check)
3. PRs should be focused and reasonably sized
4. Address reviewer feedback promptly

## Getting Help

- Open an issue for questions
- Check existing documentation in `docs/`
- Review similar PRs for examples

## Recognition

Contributors are recognized in release notes. Thank you for helping improve SocleStack!
