.PHONY: dev frontend backend mariadb-up mariadb-logs test-e2e check check-fix build seed clean-db deploy docker-up docker-down docker-logs docker-ps help

# Default target
.DEFAULT_GOAL := help

## help: Display available Makefile commands
help:
	@echo "====================================================================="
	@echo "   Digico B2B WhatsApp Platform Makefile Commands"
	@echo "====================================================================="
	@echo "  make dev          - Run both backend API (8787) & frontend app (5173)"
	@echo "  make backend      - Run Fastify backend API dev server"
	@echo "  make frontend     - Run React 19 frontend web app dev server"
	@echo "  make mariadb-up   - Start local MariaDB container (port 3307)"
	@echo "  make mariadb-logs - View live MariaDB container logs"
	@echo "  make check        - Run monorepo formatting, linting, & typechecking"
	@echo "  make check-fix    - Auto-fix formatting and linting issues across monorepo"
	@echo "  make build        - Build frontend production bundle"
	@echo "  make seed         - Populate database with initial seed data"
	@echo "  make clean-db     - Reset local PGlite database data"
	@echo "  make test-e2e     - Run Playwright E2E visual test suite"
	@echo "  make deploy       - Execute production deployment script"
	@echo "  make docker-up    - Build & launch all containers (MariaDB, Backend, Frontend)"
	@echo "  make docker-down  - Stop all running containers"
	@echo "  make docker-logs  - Stream live logs from all Docker containers"
	@echo "  make docker-ps    - List running container status"
	@echo "====================================================================="

## dev: Run both backend and frontend concurrently
dev: mariadb-up
	@docker compose stop backend frontend 2>/dev/null || true
	@echo "Stale Docker app containers stopped (mariadb kept running)."
	pnpm --filter whatsapp-webhook dev & pnpm --filter website dev

## backend: Run backend Fastify API
backend:
	@docker compose stop backend frontend 2>/dev/null || true
	pnpm --filter whatsapp-webhook dev

## frontend: Run frontend React 19 web app
frontend:
	@docker compose stop backend frontend 2>/dev/null || true
	pnpm --filter website dev

## mariadb-up: Launch MariaDB container with docker compose
mariadb-up:
	docker compose up -d mariadb

## mariadb-logs: Stream logs from MariaDB container
mariadb-logs:
	docker compose logs -f mariadb

## test-e2e: Run Playwright E2E visual test script
test-e2e:
	node run-playwright-test.js

## check: Format, lint and type-check all workspaces
check:
	pnpm --filter @digico/db check && pnpm --filter whatsapp-webhook check && pnpm --filter website exec vp check

## check-fix: Format and auto-fix all workspaces
check-fix:
	pnpm --filter @digico/db exec vp check --fix && pnpm --filter whatsapp-webhook exec vp check --fix && pnpm --filter website exec vp check --fix

## build: Build website production bundle
build:
	pnpm --filter website build

## seed: Populate MariaDB database with WooCommerce export.sql seed data
seed:
	pnpm --filter whatsapp-webhook seed

## clean-db: Reset local MariaDB database container volume
clean-db:
	docker compose down -v
	@echo "MariaDB database volume reset. Run 'make mariadb-up && make seed' to populate fresh data."

## deploy: Execute production container deployment script
deploy:
	./deploy.sh

## docker-up: Build and launch all production containers (MariaDB, Backend, Frontend)
docker-up:
	docker compose up -d --build

## docker-down: Stop and remove Docker containers
docker-down:
	docker compose down

## docker-logs: Stream logs from Docker containers
docker-logs:
	docker compose logs -f

## docker-ps: View running container status
docker-ps:
	docker compose ps
