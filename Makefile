# SocleStack - Next.js User Management Application Makefile
# Provides easy commands for development, testing, and deployment

# Configuration
APP_NAME := soclestack
DEFAULT_PORT := 3333
NODE_ENV ?= development
DATABASE_URL ?= file:./dev.db

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

.PHONY: help start stop restart dev dev-clean status setup install db-setup db-seed clean build test lint type-check

# Default command
help: ## Show this help message
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║          SocleStack - User Management Application          ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BLUE)Examples:$(NC)"
	@echo "  make start        # Start the application"
	@echo "  make stop         # Stop the application"
	@echo "  make restart      # Restart the application"
	@echo "  make status       # Check application status"
	@echo ""

# Application Control
start: ## Start the application (stops existing instance if running)
	@echo "$(BLUE)Starting $(APP_NAME)...$(NC)"
	@# Kill any process using the port (but not this make process)
	@if command -v fuser >/dev/null 2>&1; then \
		fuser -k $(DEFAULT_PORT)/tcp 2>/dev/null || true; \
	fi
	@# Clean up any stale PID file
	@if [ -f .pid ]; then \
		OLD_PID=$$(cat .pid); \
		if ps -p $$OLD_PID > /dev/null 2>&1; then \
			echo "$(YELLOW)Stopping existing instance (PID: $$OLD_PID)...$(NC)"; \
			kill $$OLD_PID 2>/dev/null || true; \
		fi; \
		rm -f .pid; \
	fi
	@# Wait for port to be free
	@sleep 2
	@# Final check if port is free
	@if ss -tulpn 2>/dev/null | grep -q ":$(DEFAULT_PORT) "; then \
		echo "$(YELLOW)Port $(DEFAULT_PORT) is still in use, attempting forceful cleanup...$(NC)"; \
		fuser -k $(DEFAULT_PORT)/tcp 2>/dev/null || true; \
		sleep 2; \
	fi
	@# Start the application
	@echo "$(GREEN)Starting $(APP_NAME) on port $(DEFAULT_PORT)...$(NC)"
	@PORT=$(DEFAULT_PORT) npm run dev > logs/app.log 2>&1 & \
		echo $$! > .pid
	@sleep 3
	@if [ -f .pid ] && kill -0 $$(cat .pid) 2>/dev/null; then \
		echo "$(GREEN)✓ $(APP_NAME) started successfully!$(NC)"; \
		echo "$(GREEN)  URL: http://localhost:$(DEFAULT_PORT)$(NC)"; \
		echo "$(GREEN)  PID: $$(cat .pid)$(NC)"; \
		echo "$(GREEN)  Logs: logs/app.log$(NC)"; \
	else \
		echo "$(RED)✗ Failed to start $(APP_NAME)$(NC)"; \
		echo "$(RED)  Check logs/app.log for details$(NC)"; \
		exit 1; \
	fi

stop: ## Stop the application
	@echo "$(BLUE)Stopping $(APP_NAME)...$(NC)"
	@if [ -f .pid ]; then \
		PID=$$(cat .pid); \
		if kill -0 $$PID 2>/dev/null; then \
			kill -15 $$PID; \
			sleep 2; \
			if kill -0 $$PID 2>/dev/null; then \
				echo "$(YELLOW)Process didn't stop gracefully, forcing...$(NC)"; \
				kill -9 $$PID 2>/dev/null || true; \
			fi; \
			echo "$(GREEN)✓ $(APP_NAME) stopped (PID: $$PID)$(NC)"; \
		else \
			echo "$(YELLOW)Process with PID $$PID not found$(NC)"; \
		fi; \
		rm -f .pid; \
	else \
		echo "$(YELLOW)No PID file found. Checking for running processes...$(NC)"; \
		if lsof -Pi :$(DEFAULT_PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
			PID=$$(lsof -Pi :$(DEFAULT_PORT) -sTCP:LISTEN -t); \
			PROC=$$(ps -p $$PID -o comm= 2>/dev/null || echo "unknown"); \
			if echo "$$PROC" | grep -q "node\|next"; then \
				echo "$(YELLOW)Found $(APP_NAME) running on port $(DEFAULT_PORT) (PID: $$PID)$(NC)"; \
				kill -15 $$PID 2>/dev/null || true; \
				sleep 2; \
				if kill -0 $$PID 2>/dev/null; then \
					kill -9 $$PID 2>/dev/null || true; \
				fi; \
				echo "$(GREEN)✓ Stopped $(APP_NAME)$(NC)"; \
			else \
				echo "$(YELLOW)Port $(DEFAULT_PORT) is used by another application ($$PROC)$(NC)"; \
			fi; \
		else \
			echo "$(YELLOW)$(APP_NAME) is not running$(NC)"; \
		fi; \
	fi

restart: ## Restart the application
	@echo "$(BLUE)Restarting $(APP_NAME)...$(NC)"
	@$(MAKE) stop
	@sleep 1
	@$(MAKE) start

status: ## Check application status
	@echo "$(BLUE)Checking $(APP_NAME) status...$(NC)"
	@echo ""
	@if [ -f .pid ]; then \
		PID=$$(cat .pid); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "$(GREEN)✓ $(APP_NAME) is running$(NC)"; \
			echo "  PID: $$PID"; \
			echo "  Port: $(DEFAULT_PORT)"; \
			echo "  URL: http://localhost:$(DEFAULT_PORT)"; \
		else \
			echo "$(RED)✗ $(APP_NAME) is not running (stale PID file)$(NC)"; \
			rm -f .pid; \
		fi; \
	else \
		if lsof -Pi :$(DEFAULT_PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
			PID=$$(lsof -Pi :$(DEFAULT_PORT) -sTCP:LISTEN -t); \
			PROC=$$(ps -p $$PID -o comm= 2>/dev/null || echo "unknown"); \
			if echo "$$PROC" | grep -q "node\|next"; then \
				echo "$(YELLOW)⚠ $(APP_NAME) is running but no PID file found$(NC)"; \
				echo "  PID: $$PID"; \
				echo "  Port: $(DEFAULT_PORT)"; \
				echo "  URL: http://localhost:$(DEFAULT_PORT)"; \
			else \
				echo "$(RED)✗ Port $(DEFAULT_PORT) is used by another application ($$PROC)$(NC)"; \
			fi; \
		else \
			echo "$(RED)✗ $(APP_NAME) is not running$(NC)"; \
		fi; \
	fi
	@echo ""

# Development
dev: start ## Start development server (alias for start)

dev-clean: clean start ## Clean and start fresh

logs: ## Show application logs
	@if [ -f logs/app.log ]; then \
		echo "$(BLUE)Showing last 50 lines of logs:$(NC)"; \
		tail -50 logs/app.log; \
	else \
		echo "$(YELLOW)No log file found$(NC)"; \
	fi

logs-follow: ## Follow application logs in real-time
	@if [ -f logs/app.log ]; then \
		echo "$(BLUE)Following logs (Ctrl+C to stop):$(NC)"; \
		tail -f logs/app.log; \
	else \
		echo "$(YELLOW)No log file found$(NC)"; \
	fi

# Setup & Installation
setup: install db-setup db-seed ## Complete project setup (install + database + seed)
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo "$(GREEN)Run 'make start' to start the application$(NC)"

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@npm install
	@mkdir -p logs
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

# Database Management
db-setup: ## Setup database (generate client + push schema)
	@echo "$(BLUE)Setting up database...$(NC)"
	@if [ -f .env.local ] && [ ! -f .env ]; then cp .env.local .env; fi
	@npx prisma generate
	@npx prisma db push
	@echo "$(GREEN)✓ Database setup complete$(NC)"

db-seed: ## Seed database with demo users
	@echo "$(BLUE)Seeding database...$(NC)"
	@npm run db:seed
	@echo "$(GREEN)✓ Database seeded with demo users$(NC)"

db-reset: ## Reset database (WARNING: destroys all data)
	@echo "$(RED)WARNING: This will destroy all data!$(NC)"
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@rm -f prisma/dev.db
	@$(MAKE) db-setup
	@$(MAKE) db-seed
	@echo "$(GREEN)✓ Database reset complete$(NC)"

db-studio: ## Open Prisma Studio (database GUI)
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	@npx prisma studio

# Code Quality
lint: ## Run ESLint
	@echo "$(BLUE)Running linter...$(NC)"
	@npm run lint

lint-fix: ## Run ESLint and fix issues
	@echo "$(BLUE)Running linter with auto-fix...$(NC)"
	@npm run lint -- --fix

type-check: ## Run TypeScript type checking
	@echo "$(BLUE)Running type check...$(NC)"
	@npx tsc --noEmit

format: ## Format code with Prettier (if available)
	@echo "$(BLUE)Formatting code...$(NC)"
	@if command -v prettier >/dev/null 2>&1; then \
		prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}"; \
		echo "$(GREEN)✓ Code formatted$(NC)"; \
	else \
		echo "$(YELLOW)Prettier not installed. Run: npm install -D prettier$(NC)"; \
	fi

# Testing
test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	@npm run test

test-e2e: ## Run end-to-end tests with Playwright
	@echo "$(BLUE)Running E2E tests...$(NC)"
	@npx playwright test

test-e2e-ui: ## Run Playwright tests with UI mode
	@echo "$(BLUE)Opening Playwright UI...$(NC)"
	@npx playwright test --ui

# Build & Production
build: ## Build application for production
	@echo "$(BLUE)Building for production...$(NC)"
	@npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

prod: build ## Build and start production server
	@echo "$(BLUE)Starting production server...$(NC)"
	@npm start

# Cleanup
clean: ## Clean build artifacts and dependencies
	@echo "$(BLUE)Cleaning...$(NC)"
	@rm -rf .next
	@rm -rf node_modules
	@rm -rf dist
	@rm -rf build
	@rm -f .pid
	@rm -f logs/*.log
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-cache: ## Clean Next.js cache
	@echo "$(BLUE)Cleaning cache...$(NC)"
	@rm -rf .next
	@echo "$(GREEN)✓ Cache cleaned$(NC)"

# Environment Management
env-check: ## Check environment variables
	@echo "$(BLUE)Checking environment variables...$(NC)"
	@if [ -f .env.local ]; then \
		echo "$(GREEN)✓ .env.local exists$(NC)"; \
		if grep -q "DATABASE_URL=" .env.local; then \
			echo "$(GREEN)✓ DATABASE_URL set$(NC)"; \
		else \
			echo "$(RED)✗ DATABASE_URL missing$(NC)"; \
		fi; \
		if grep -q "SESSION_SECRET=" .env.local; then \
			echo "$(GREEN)✓ SESSION_SECRET set$(NC)"; \
		else \
			echo "$(RED)✗ SESSION_SECRET missing$(NC)"; \
		fi; \
		if grep -q "JWT_SECRET=" .env.local; then \
			echo "$(GREEN)✓ JWT_SECRET set$(NC)"; \
		else \
			echo "$(RED)✗ JWT_SECRET missing$(NC)"; \
		fi; \
	else \
		echo "$(RED)✗ .env.local not found$(NC)"; \
		echo "$(YELLOW)Run 'make setup' to create it$(NC)"; \
	fi

# Quick Commands
quick-start: setup start ## Quick setup and start from scratch

reset-all: clean setup start ## Complete reset and restart

# Git Commands
commit: ## Commit all changes
	@git add .
	@git status
	@echo "$(BLUE)Enter commit message:$(NC)"
	@read -r MESSAGE; \
	git commit -m "$$MESSAGE"

# Docker Support (if needed in future)
docker-build: ## Build Docker image
	@if [ -f Dockerfile ]; then \
		docker build -t $(APP_NAME) .; \
		echo "$(GREEN)✓ Docker image built$(NC)"; \
	else \
		echo "$(YELLOW)Dockerfile not found$(NC)"; \
		echo "$(YELLOW)Create a Dockerfile to use Docker commands$(NC)"; \
	fi

docker-run: ## Run application in Docker container
	@if docker images | grep -q $(APP_NAME); then \
		docker run -p $(DEFAULT_PORT):$(DEFAULT_PORT) --env-file .env.local $(APP_NAME); \
	else \
		echo "$(RED)Docker image not found. Run 'make docker-build' first$(NC)"; \
	fi

# Health Check
health: ## Health check for the application
	@echo "$(BLUE)Performing health check...$(NC)"
	@if curl -f -s http://localhost:$(DEFAULT_PORT) >/dev/null 2>&1; then \
		echo "$(GREEN)✓ Application is healthy$(NC)"; \
	else \
		echo "$(RED)✗ Application is not responding$(NC)"; \
	fi

# Info Commands
info: ## Show application information
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║                 Application Information                    ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "  Name:        $(APP_NAME)"
	@echo "  Port:        $(DEFAULT_PORT)"
	@echo "  Environment: $(NODE_ENV)"
	@echo "  Database:    $(DATABASE_URL)"
	@echo ""
	@echo "$(BLUE)Demo Users:$(NC)"
	@echo "  Admin:     admin@demo.com / Demo123!"
	@echo "  User:      user@demo.com / Demo123!"
	@echo "  Moderator: moderator@demo.com / Demo123!"
	@echo ""

# Default target
.DEFAULT_GOAL := help