# Swachh AI — Intelligent Circular Waste Ecosystem

Production-ready backend for Swachh AI with AI waste classification, real-time stream processing, IoT bin simulation, route optimization, reward system, leaderboard, and environmental impact analysis.

## Features

- YOLOv8m waste classification with normalized waste categories
- Bin simulation and event streaming
- Real-time overflow detection with Pathway 0.29.0
- Route optimization (greedy nearest neighbor with fill priority)
- Mapbox integration with fallback
- Ward-based reward system with segregation score calculation
- Delhi ward leaderboard with Swachh Score
- Environmental impact metrics
- Health checks for database, model, Redis
- Dockerized with PostgreSQL and Redis

## Prerequisites

- Python 3.11
- PostgreSQL (if running locally)
- YOLOv8m model file (`yolov8m.pt`) placed in `models/` directory

## Quick Start with Docker

1. Clone repository.
2. Copy `.env.example` to `.env` and adjust variables (especially MAP_API_KEY if desired).
3. Place YOLO model in `models/yolov8m.pt`.
4. Run `docker-compose up --build`
5. Access API at `http://localhost:8000/api`

## Local Development

1. Create virtual environment: `python -m venv venv`
2. Activate: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install -r requirements.txt`
4. Ensure PostgreSQL is running and database `swachh_db` exists.
5. Run FastAPI: `uvicorn app.main:app --reload`
6. In another terminal, run Pathway pipeline: `python app/pathway_pipeline/pipeline.py`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/classify-waste` | POST | Upload image for waste classification |
| `/api/update-bin` | POST | Update bin fill level and waste type |
| `/api/bins` | GET | List all bins |
| `/api/bins` | POST | Create a new bin |
| `/api/optimize-route` | POST | Get optimized route for given bin IDs |
| `/api/rewards/{ward_id}` | GET | Get reward points and segregation score |
| `/api/leaderboard` | GET | Get top and bottom wards by Swachh Score |
| `/api/impact/{ward_id}` | GET | Get environmental impact metrics |
| `/api/health` | GET | Comprehensive health check |
| `/api/db-health` | GET | Database health |
| `/api/model-health` | GET | Model health |
| `/api/redis-health` | GET | Redis health |

## Deployment

### Render

- Create a new Web Service pointing to this repo.
- Set build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add environment variables from `.env`.
- For Pathway, create a separate Background Worker with command `python app/pathway_pipeline/pipeline.py`.

### AWS ECS

- Build Docker image and push to ECR.
- Create task definitions for backend and pathway containers.
- Use RDS for PostgreSQL and ElastiCache for Redis.

### Railway

- Connect GitHub repo.
- Add PostgreSQL and Redis plugins.
- Railway automatically detects Dockerfile and runs it.
- Set environment variables.