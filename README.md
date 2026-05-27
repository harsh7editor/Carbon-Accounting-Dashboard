# Carbon Data Review Platform

## Overview
This application is designed to ingest emission-related data from multiple sources, normalize it, validate it, and support a review workflow for carbon accounting.

The repository contains:
- `backend/`: Django REST API, processing pipeline, models, and admin logic
- `frontend/`: React + TypeScript web app for user interaction and review workflows
- `api/`: legacy or shared API module (not the primary backend application)

## Working Process
The continuous working process of the app is:

1. User login
   - `backend` uses JWT authentication via `CustomTokenObtainPairView`
   - Each user belongs to a `Tenant` and may be an `ADMIN` or `ANALYST`

2. Data source registration
   - `DataSource` records define input source types: `SAP`, `UTILITY`, or `TRAVEL`
   - Tenants can manage their own sources, plant codes, and relevant reference data

3. Upload batch creation
   - A user uploads a CSV file through the app
   - The backend receives the file in `UploadBatchViewSet.upload_file`
   - It creates an `UploadBatch` record with `status = PENDING`

4. Continuous CSV processing
   - The backend reads the uploaded CSV payload and detects the delimiter
   - `process_csv_upload` parses each row and stores it as a `RawRecord`
   - Each row is normalized and validated by source-specific logic:
     - `SAP` fuel data normalization
     - `UTILITY` electricity/billing data normalization
     - `TRAVEL` corporate travel normalization
   - For every row processed, a `NormalizedRecord` and `ReviewRecord` are created
   - Row processing continues for the full file, tracking both success and failure counts
   - Batch status updates to `SUCCESS` or `FAILED` once processing completes
   - An `AuditLog` entry is created for the upload batch

5. Review workflow
   - Normalized records are presented through the frontend review queue
   - Each record has a linked `ReviewRecord` with `validation_status` and `review_status`
   - Reviewers can approve, reject, or request correction for records
   - Record edits trigger recalculation of emissions metrics when relevant fields change

6. Continuous iteration
   - New uploads can be submitted at any time for the same tenant
   - Failed records remain visible for correction or reprocessing
   - The audit log captures user actions, approvals, edits, and uploads

## Key backend flow
- `backend/api/views.py` contains the REST viewsets and upload endpoint
- `backend/api/services.py` contains the CSV parsing, row normalization, and validation pipeline
- `backend/api/models.py` defines tenants, users, batch records, raw records, normalized records, reviews, and audit logs

## How to run
1. Create and activate your Python virtual environment
2. Install backend dependencies with `pip install -r backend/requirements.txt` if available
3. Run Django migrations in `backend/`
4. Start the backend server with `python manage.py runserver`
5. Install frontend dependencies in `frontend/` with `npm install`
6. Start the frontend with `npm run dev`

## Continuous Integration

A GitHub Actions workflow was added to run backend tests and build the frontend on push and pull requests. The workflow lives at [.github/workflows/ci.yml](.github/workflows/ci.yml#L1).

The workflow will:
- Install backend dependencies from `backend/requirements.txt` if present (falls back to a minimal set of packages otherwise).
- Run Django migrations and the backend test suite.
- Install frontend dependencies and run a production build.

## Quick local commands
Run backend migrations and server:

```bash
python backend/manage.py migrate
python backend/manage.py runserver
```

Install and run frontend dev server:

```bash
cd frontend
npm ci
npm run dev
```

Or use the included Makefile:

```bash
make backend-setup      # install backend requirements
make backend-run        # run backend server
make frontend-install   # install frontend deps
make frontend-run       # start frontend dev server
```

## Notes
- The app is built to continually process and retain all upload data.
- Errors for individual rows are logged, but processing continues for the remaining records.
- This makes the workflow robust for real-world CSV ingestion and iterative review.

## Docker

A Docker setup and `docker-compose.yml` were added to run the app and a Celery worker with Redis.

To build and start services:

```bash
docker compose build
docker compose up -d
```

Services available:
- `web` (Django) on http://localhost:8000
- `frontend` (static build served by nginx) on http://localhost:8080
- `redis` on port 6379
- `worker` Celery worker processing upload tasks

View logs:

```bash
docker compose logs -f web
docker compose logs -f worker
```

