.PHONY: up down logs clean restart status ps shell-postgres shell-redis test-e2e test-e2e-api test-e2e-ui test-e2e-ci

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help message
	@echo "$(CYAN)Dependency Mapping Platform - Development Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

up: ## Start all services (infrastructure only, no API)
	@echo "$(GREEN)Starting infrastructure services...$(NC)"
	docker compose up -d postgres redis minio
	@echo "$(GREEN)Services started. Run 'make status' to check health.$(NC)"

up-full: ## Start all services including API
	@echo "$(GREEN)Starting all services including API...$(NC)"
	docker compose --profile full up -d
	@echo "$(GREEN)All services started.$(NC)"

down: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	docker compose --profile full down
	@echo "$(GREEN)All services stopped.$(NC)"

logs: ## View logs from all services
	docker compose logs -f

logs-postgres: ## View PostgreSQL logs
	docker compose logs -f postgres

logs-redis: ## View Redis logs
	docker compose logs -f redis

logs-minio: ## View MinIO logs
	docker compose logs -f minio

logs-api: ## View API logs
	docker compose logs -f api

restart: down up ## Restart all services

status: ## Show service status and health
	@echo "$(CYAN)Service Status:$(NC)"
	@docker compose ps
	@echo ""
	@echo "$(CYAN)Health Checks:$(NC)"
	@docker inspect --format='{{.Name}}: {{.State.Health.Status}}' $$(docker compose ps -q 2>/dev/null) 2>/dev/null || echo "No services running"

ps: ## List running containers
	docker compose ps

clean: ## Stop services and remove volumes (WARNING: destroys data)
	@echo "$(YELLOW)WARNING: This will destroy all data in volumes!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose --profile full down -v
	@echo "$(GREEN)Cleanup complete.$(NC)"

shell-postgres: ## Open PostgreSQL shell
	docker compose exec postgres psql -U $${POSTGRES_USER:-dmp} -d $${POSTGRES_DB:-dmp_dev}

verify-extensions: ## Verify PostgreSQL extensions are installed
	@echo "$(CYAN)Checking PostgreSQL extensions...$(NC)"
	@docker compose exec postgres psql -U $${POSTGRES_USER:-dmp} -d $${POSTGRES_DB:-dmp_dev} -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"

migrate: ## Run all database migrations
	@echo "$(CYAN)Running database migrations...$(NC)"
	@for f in migrations/*.sql; do \
		echo "$(GREEN)Applying $$f...$(NC)"; \
		docker compose exec -T postgres psql -U $${POSTGRES_USER:-dmp} -d $${POSTGRES_DB:-dmp_dev} -f /migrations/$$(basename $$f) 2>&1 || true; \
	done
	@echo "$(GREEN)Migrations complete!$(NC)"

migrate-status: ## Show applied migrations
	@echo "$(CYAN)Applied migrations:$(NC)"
	@docker compose exec postgres psql -U $${POSTGRES_USER:-dmp} -d $${POSTGRES_DB:-dmp_dev} -c "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;" 2>/dev/null || echo "No migrations applied yet"

migrate-reset: ## Reset database and re-run migrations (WARNING: destroys data)
	@echo "$(YELLOW)WARNING: This will destroy all data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker compose exec postgres psql -U $${POSTGRES_USER:-dmp} -c "DROP DATABASE IF EXISTS $${POSTGRES_DB:-dmp_dev}; CREATE DATABASE $${POSTGRES_DB:-dmp_dev};"
	@$(MAKE) migrate

shell-redis: ## Open Redis CLI
	docker compose exec redis redis-cli

verify-redis: ## Verify Redis configuration and Streams
	@echo "$(CYAN)Checking Redis configuration...$(NC)"
	@docker compose exec redis redis-cli CONFIG GET maxmemory
	@docker compose exec redis redis-cli CONFIG GET maxmemory-policy
	@echo ""
	@echo "$(CYAN)Testing Redis Streams...$(NC)"
	@docker compose exec redis redis-cli XADD dmp-test-stream '*' msg hello type test
	@docker compose exec redis redis-cli XRANGE dmp-test-stream - +
	@docker compose exec redis redis-cli DEL dmp-test-stream
	@echo "$(GREEN)Redis Streams working!$(NC)"

shell-minio: ## Open MinIO client shell (interactive)
	@echo "$(CYAN)Starting MinIO client shell...$(NC)"
	@docker run -it --rm --network dmp-network minio/mc alias set local http://minio:9000 $${MINIO_ROOT_USER:-minioadmin} $${MINIO_ROOT_PASSWORD:-minioadmin} && mc

verify-minio: ## Verify MinIO buckets and configuration
	@echo "$(CYAN)Checking MinIO buckets...$(NC)"
	@docker run --rm --network dmp-network \
		-e MINIO_ROOT_USER=$${MINIO_ROOT_USER:-minioadmin} \
		-e MINIO_ROOT_PASSWORD=$${MINIO_ROOT_PASSWORD:-minioadmin} \
		minio/mc sh -c '\
			mc alias set local http://minio:9000 $$MINIO_ROOT_USER $$MINIO_ROOT_PASSWORD && \
			echo "=== Buckets ===" && \
			mc ls local/ && \
			echo "" && \
			echo "=== Lifecycle Rules ===" && \
			mc ilm rule ls local/dmp-repos 2>/dev/null || echo "No rules for dmp-repos" && \
			mc ilm rule ls local/dmp-scans 2>/dev/null || echo "No rules for dmp-scans"'
	@echo "$(GREEN)MinIO configuration verified!$(NC)"

init: ## Initialize development environment
	@echo "$(GREEN)Initializing development environment...$(NC)"
	@cp -n .env.example .env 2>/dev/null || true
	@echo "$(GREEN)Environment file created. Edit .env as needed.$(NC)"
	@$(MAKE) up
	@echo "$(GREEN)Waiting for services to be healthy...$(NC)"
	@sleep 10
	@$(MAKE) status

test-connections: ## Test connections to all services
	@echo "$(CYAN)Testing PostgreSQL...$(NC)"
	@docker compose exec postgres pg_isready -U $${POSTGRES_USER:-dmp} && echo "$(GREEN)PostgreSQL OK$(NC)" || echo "$(YELLOW)PostgreSQL not ready$(NC)"
	@echo "$(CYAN)Testing Redis...$(NC)"
	@docker compose exec redis redis-cli ping && echo "$(GREEN)Redis OK$(NC)" || echo "$(YELLOW)Redis not ready$(NC)"
	@echo "$(CYAN)Testing MinIO...$(NC)"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:$${MINIO_API_PORT:-9000}/minio/health/live | grep -q 200 && echo "$(GREEN)MinIO OK$(NC)" || echo "$(YELLOW)MinIO not ready$(NC)"

# ============================================================================
# E2E Testing Commands
# ============================================================================

test-e2e: ## Run all E2E tests (API + UI)
	@echo "$(CYAN)Running E2E tests...$(NC)"
	cd e2e && npm run test
	@echo "$(GREEN)E2E tests complete.$(NC)"

test-e2e-api: ## Run E2E API tests with Vitest
	@echo "$(CYAN)Running E2E API tests...$(NC)"
	cd e2e && npm run test:api
	@echo "$(GREEN)E2E API tests complete.$(NC)"

test-e2e-ui: ## Run E2E UI tests with Playwright
	@echo "$(CYAN)Running E2E UI tests...$(NC)"
	cd e2e && npm run test:ui
	@echo "$(GREEN)E2E UI tests complete.$(NC)"

test-e2e-ui-headed: ## Run E2E UI tests with visible browser
	@echo "$(CYAN)Running E2E UI tests (headed mode)...$(NC)"
	cd e2e && npm run test:ui:headed

test-e2e-ui-debug: ## Run E2E UI tests in debug mode
	@echo "$(CYAN)Running E2E UI tests (debug mode)...$(NC)"
	cd e2e && npm run test:ui:debug

test-e2e-report: ## Show Playwright test report
	@echo "$(CYAN)Opening Playwright report...$(NC)"
	cd e2e && npm run test:ui:report

test-e2e-ci: ## Run E2E tests for CI environment
	@echo "$(CYAN)Running E2E tests (CI mode)...$(NC)"
	cd e2e && npm run test:ci
	@echo "$(GREEN)E2E CI tests complete.$(NC)"

test-e2e-coverage: ## Run E2E tests with coverage
	@echo "$(CYAN)Running E2E tests with coverage...$(NC)"
	cd e2e && npm run test:coverage
	@echo "$(GREEN)Coverage report generated.$(NC)"

test-e2e-setup: ## Install Playwright browsers
	@echo "$(CYAN)Setting up Playwright browsers...$(NC)"
	cd e2e && npm run setup
	@echo "$(GREEN)Playwright setup complete.$(NC)"

test-e2e-deps: ## Analyze E2E dependencies
	@echo "$(CYAN)Analyzing E2E dependencies...$(NC)"
	cd e2e && npx tsx scripts/analyze-dependencies.ts
	@echo "$(GREEN)Dependency analysis complete.$(NC)"

test-e2e-deps-fix: ## Fix E2E dependency issues
	@echo "$(CYAN)Fixing E2E dependency issues...$(NC)"
	cd e2e && npx tsx scripts/analyze-dependencies.ts --fix
	@echo "$(GREEN)Dependency fix complete.$(NC)"
