# Expense Tracker Starter

A full-stack personal finance dashboard for recording spending, tracking budget health, and reviewing transaction history.

## Product overview
This application helps users monitor money movement across categories, understand monthly totals, and compare actual spending to a budget. It is a practical product for dashboard design, filtering, and financial reporting.

## Core user experience
- add income and expense entries
- assign each transaction to a category
- review totals by month or category
- see remaining budget and spending trends
- filter the transaction list by type or date range
- understand overall financial performance at a glance

## MVP features to implement
- transaction creation and editing
- category-based tracking
- monthly summary cards
- transaction list with filtering
- budget overview and remaining balance
- seeded sample data for demonstration

## Optional PM enhancements
- recurring transactions
- budget alerts and warnings
- CSV export
- shared household budget features
- category trend charts
- savings goal tracking

## Tech stack
- Backend: Node.js, Express, TypeScript
- Frontend: React + TypeScript
- Database: PostgreSQL + Prisma
- Tooling: Docker Compose

## Getting started

### Prerequisites

Install the following before starting:

- Git
- Node.js 20 or later, which includes npm
- Docker Desktop or Docker Engine with Docker Compose

### Create your project copy

1. Click **Fork** and create the fork in your own account or team organization. Forking creates your GitHub copy; it does not download the files to your computer.
2. Clone your fork, replacing `YOUR-GITHUB-USERNAME` with the account or organization that owns your fork:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/cs450-expense-tracker-starter.git
cd cs450-expense-tracker-starter
```

### Configure and start the application

Run these commands from the project root:

```bash
cp backend/.env.example backend/.env
npm --prefix backend install
npm --prefix frontend install
docker compose up -d
cd backend
npx prisma generate
npx prisma migrate dev --name init
cd ..
```

The database runs in Docker on port `5434`. The migration command creates the
database tables from the Prisma schema.

Open two terminal windows from the project root and start the application:

Terminal 1, the backend:

```bash
npm --prefix backend run dev
```

Terminal 2, the frontend:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5175 in a browser. The backend API is available at
http://localhost:4002.

To stop the database, run this from the project root:

```bash
docker compose down
```

## Expected project outcomes
- a working budgeting and transaction workflow
- a prioritized product backlog for improvement work
- a deployable app setup with clear documentation
- a final demo highlighting financial features and product decisions
