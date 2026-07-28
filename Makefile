.PHONY: dev frontend backend test-e2e check check-fix build clean-db docker-up docker-down docker-logs docker-ps help

# Default target
.DEFAULT_GOAL := help

## help: Display available Makefile commands
help:
	@echo "Available commands:"
	@echo "  make dev          - Run both backend API (8787) and frontend web app (5173) locally"
	@echo "  make backend      - Run Fastify backend API dev server"
	@echo "  make frontend     - Run React 19 frontend web app dev server"
	@echo "  make test-e2e     - Run Playwright end-to-end visual tests"
	@echo "  make check        - Run linting, formatting, and typechecking across monorepo"
	@echo "  make check-fix    - Auto-fix formatting and linting issues"
	@echo "  make build        - Build production bundle for website"
	@echo "  make clean-db     - Reset local PGlite database"
	@echo "  make deploy       - Execute automated production server deployment script"
	@echo "  make docker-up    - Build and launch production Docker containers"
	@echo "  make docker-down  - Stop and remove Docker containers"
	@echo "  make docker-logs  - Follow production Docker container logs"
	@echo "  make docker-ps    - List running Docker container status"

## dev: Run both backend and frontend concurrently
dev:
	pnpm --filter whatsapp-webhook dev & pnpm --filter website dev

## backend: Run backend Fastify API
backend:
	pnpm --filter whatsapp-webhook dev

## frontend: Run frontend React 19 web app
frontend:
	pnpm --filter website dev

## test-e2e: Run Playwright E2E visual test script
test-e2e:
	node run-playwright-test.js

## check: Run Vite+ checks (formatting, linting, typechecking)
check:
	pnpm exec vp check

## check-fix: Auto-fix linting and formatting issues
check-fix:
	pnpm exec vp check --fix

## build: Build website production bundle
build:
	pnpm --filter website build

## clean-db: Delete local PGlite database files to re-seed fresh data
clean-db:
	rm -rf ./data/db apps/whatsapp-webhook/data/db
	@echo "Local PGlite database cleaned. Fresh data will seed on next server boot."

## deploy: Execute automated production deployment script
deploy:
	./deploy.sh

## docker-up: Build and launch production containers with Docker Compose
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
