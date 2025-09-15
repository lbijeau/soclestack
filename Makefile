# Next.js User Management Application Makefile
# Provides easy commands for development, testing, and deployment

.PHONY: help install dev build start test clean setup db-setup db-migrate db-reset lint format docker-build docker-run

# Default command
help: ## Show this help message
	@echo "Next.js User Management Application"
	@echo "Usage: make [command]"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Setup
install: ## Install dependencies
	npm install

setup: install ## Complete project setup (install + database setup with SQLite)
	@echo "Setting up environment with SQLite..."
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local 2>/dev/null || echo "# Database (SQLite for easy local development)\nDATABASE_URL=\"file:./dev.db\"\n\n# JWT Secrets\nJWT_SECRET=\"dev-jwt-secret-change-in-production\"\nJWT_REFRESH_SECRET=\"dev-refresh-secret-change-in-production\"\n\n# Session Secret\nSESSION_SECRET=\"dev-session-secret-change-in-production\"\n\n# App Configuration\nNEXTAUTH_URL=\"http://localhost:3000\"\nNEXTAUTH_SECRET=\"dev-nextauth-secret-change-in-production\"\n\n# Security\nCSRF_SECRET=\"dev-csrf-secret-change-in-production\"" > .env.local; \
		echo "Created .env.local with SQLite configuration"; \
	fi
	@make db-setup

setup-postgres: install ## Setup with PostgreSQL using Docker
	@echo "Setting up environment with PostgreSQL..."
	@if [ ! -f .env.local ]; then \
		cp .env.postgres .env.local; \
		echo "Created .env.local with PostgreSQL configuration"; \
	fi
	@echo "Starting PostgreSQL with Docker..."
	docker-compose up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	@make db-setup

# Database Management
db-setup: ## Setup database (generate client + push schema)
	@if [ -f .env.local ] && [ ! -f .env ]; then cp .env.local .env; fi
	npx prisma generate
	npx prisma db push

db-migrate: ## Apply database migrations
	npx prisma migrate dev

db-reset: ## Reset database (WARNING: destroys all data)
	npx prisma migrate reset --force
	npx prisma db push

db-studio: ## Open Prisma Studio (database GUI)
	npx prisma studio

db-seed: ## Seed database with demo users
	npm run db:seed

# Development
dev: ## Start development server with Turbopack
	npm run dev

build: ## Build application for production
	npm run build

start: ## Start production server (requires build first)
	npm run start

preview: build start ## Build and start production server

# Code Quality
lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint and fix issues
	npm run lint -- --fix

format: ## Format code with Prettier (if available)
	@if command -v prettier >/dev/null 2>&1; then \
		prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}"; \
	else \
		echo "Prettier not installed. Run: npm install -D prettier"; \
	fi

type-check: ## Run TypeScript type checking
	npx tsc --noEmit

# Testing
test: ## Run all tests
	npm run test

test-unit: ## Run unit tests (if available)
	@if npm run test:unit 2>/dev/null; then \
		npm run test:unit; \
	else \
		echo "Unit tests not configured"; \
	fi

test-e2e: ## Run end-to-end tests with Playwright
	npx playwright test

test-e2e-ui: ## Run Playwright tests with UI mode
	npx playwright test --ui

test-e2e-headed: ## Run Playwright tests in headed mode
	npx playwright test --headed

test-auth: ## Run authentication tests only
	npx playwright test tests/e2e/auth/

test-user-management: ## Run user management tests only
	npx playwright test tests/e2e/user-management/

test-performance: ## Run performance tests
	npx playwright test tests/e2e/performance/

test-accessibility: ## Run accessibility tests
	npx playwright test tests/e2e/accessibility/

test-report: ## Show Playwright test report
	npx playwright show-report

# Security & Dependencies
security-audit: ## Run npm security audit
	npm audit

security-fix: ## Fix security vulnerabilities
	npm audit fix

update-deps: ## Update dependencies (use with caution)
	npm update

check-outdated: ## Check for outdated dependencies
	npm outdated

# Docker Support
docker-build: ## Build Docker image
	@if [ -f Dockerfile ]; then \
		docker build -t nextjs-user-management .; \
	else \
		echo "Dockerfile not found. Create one to use Docker commands."; \
	fi

docker-run: ## Run application in Docker container
	@if docker images | grep -q nextjs-user-management; then \
		docker run -p 3000:3000 --env-file .env.local nextjs-user-management; \
	else \
		echo "Docker image not found. Run 'make docker-build' first."; \
	fi

postgres-start: ## Start PostgreSQL with Docker
	docker-compose up -d postgres
	@echo "PostgreSQL started. Waiting for it to be ready..."
	@sleep 5

postgres-stop: ## Stop PostgreSQL Docker container
	docker-compose down

postgres-logs: ## View PostgreSQL logs
	docker-compose logs -f postgres

postgres-shell: ## Connect to PostgreSQL shell
	docker-compose exec postgres psql -U soclestack -d soclestack

# Database Backup & Restore (PostgreSQL)
db-backup: ## Backup database (requires PostgreSQL tools)
	@echo "Creating database backup..."
	@if command -v pg_dump >/dev/null 2>&1; then \
		pg_dump $(shell grep DATABASE_URL .env.local | cut -d '=' -f2) > backup_$(shell date +%Y%m%d_%H%M%S).sql; \
		echo "Backup created: backup_$(shell date +%Y%m%d_%H%M%S).sql"; \
	else \
		echo "pg_dump not found. Install PostgreSQL client tools."; \
	fi

# Cleanup
clean: ## Clean build artifacts and dependencies
	rm -rf .next
	rm -rf node_modules
	rm -rf dist
	rm -rf build

clean-cache: ## Clean Next.js cache
	rm -rf .next
	npm run build

# Environment Management
env-check: ## Check environment variables
	@echo "Checking required environment variables..."
	@if [ -f .env.local ]; then \
		echo "✅ .env.local exists"; \
		if grep -q "DATABASE_URL=" .env.local; then echo "✅ DATABASE_URL set"; else echo "❌ DATABASE_URL missing"; fi; \
		if grep -q "NEXTAUTH_SECRET=" .env.local; then echo "✅ NEXTAUTH_SECRET set"; else echo "❌ NEXTAUTH_SECRET missing"; fi; \
		if grep -q "NEXTAUTH_URL=" .env.local; then echo "✅ NEXTAUTH_URL set"; else echo "❌ NEXTAUTH_URL missing"; fi; \
	else \
		echo "❌ .env.local not found. Run 'make setup' first."; \
	fi

# Development Workflow Commands
dev-fresh: clean install db-reset dev ## Fresh development start (clean + install + reset DB + dev)

quick-start: ## Quick start for existing setup
	@make env-check
	@make db-setup
	@make dev

deploy-check: ## Check if ready for deployment
	@make env-check
	@make lint
	@make type-check
	@make build
	@echo "✅ Ready for deployment"

# Git Hooks (if using)
install-hooks: ## Install git hooks (if .git/hooks directory exists)
	@if [ -d .git ]; then \
		echo "Installing git hooks..."; \
		echo "#!/bin/sh\nmake lint" > .git/hooks/pre-commit; \
		chmod +x .git/hooks/pre-commit; \
		echo "✅ Pre-commit hook installed"; \
	else \
		echo "Not a git repository"; \
	fi

# Production Deployment Helpers
prod-build: ## Production build with optimizations
	NODE_ENV=production npm run build

# Monitoring and Health Checks
health-check: ## Basic health check
	@if curl -f http://localhost:3000/api/health 2>/dev/null; then \
		echo "✅ Application is running"; \
	else \
		echo "❌ Application is not responding"; \
	fi

# Documentation
docs: ## Generate documentation (if available)
	@echo "Documentation available in:"
	@echo "  - README.md"
	@echo "  - docs/ directory"
	@echo "  - TECHNICAL_ARCHITECTURE.md"
	@echo "  - IMPLEMENTATION_PLAN.md"

# Common Development Workflows
reset: clean install db-reset ## Complete reset (clean + install + reset DB)

fresh: reset dev ## Complete fresh start

ci: install lint type-check build test ## CI pipeline simulation

# Emergency Commands
force-unlock: ## Force unlock if package manager is stuck
	rm -f package-lock.json
	rm -rf node_modules
	npm install

fix-permissions: ## Fix file permissions (Unix/Linux)
	find . -type f -name "*.js" -o -name "*.ts" -o -name "*.json" | xargs chmod 644
	find . -type d | xargs chmod 755

# Default target when no argument is provided
.DEFAULT_GOAL := help