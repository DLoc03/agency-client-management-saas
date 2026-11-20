.PHONY: up down logs ps test-api test-web

up:        ## Start the full local stack
	docker compose up

down:      ## Stop the local stack
	docker compose down

logs:      ## Follow logs of all services
	docker compose logs -f

ps:        ## Show running services
	docker compose ps

test-api:  ## Run backend tests inside the api container
	docker compose exec api php artisan test

test-web:  ## Run frontend unit tests inside the web container
	docker compose exec web pnpm test
