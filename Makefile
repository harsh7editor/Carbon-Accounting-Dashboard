.PHONY: backend-setup backend-run backend-test frontend-install frontend-run frontend-build ci

backend-setup:
	pip install -r backend/requirements.txt

backend-run:
	python backend/manage.py runserver

backend-test:
	python backend/manage.py test

frontend-install:
	cd frontend && npm ci

frontend-run:
	cd frontend && npm run dev

frontend-live:
	powershell -ExecutionPolicy Bypass -File scripts/frontend-live.ps1

frontend-build:
	cd frontend && npm run build

ci:
	make backend-test frontend-build
