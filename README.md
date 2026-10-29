# AgentGov AI

A starter full-stack Multi-Agent AI Governance Platform:
- React + TypeScript + Vite frontend
- FastAPI backend
- MongoDB Atlas persistence
- OpenAI-powered Research, Analyst, and Reviewer agents
- Basic policy checks, human approval queue, and audit events

## Requirements
- Python 3.11+
- Node.js 20+
- MongoDB Atlas connection string
- OpenAI API key

## 1. Configure the backend
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```
Edit `backend/.env` and set `MONGODB_URI`, `MONGODB_DB`, `OPENAI_API_KEY`, and `JWT_SECRET` (the latter is reserved for the authentication phase).

## 2. Start the backend
```powershell
uvicorn app.main:app --reload --port 8000
```
Open http://localhost:8000/docs and test `GET /api/health`.

## 3. Start the frontend
In a second PowerShell terminal:
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open the Vite URL shown in the terminal (usually http://localhost:5173).

## API routes
- `GET /api/health`
- `GET /api/agents`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `POST /api/tasks/{task_id}/approve`
- `GET /api/policies`
- `GET /api/audit`

## Important safety note
This is an educational MVP, not production security. The current approval gate is a simple keyword-based demonstration. Before real organizational use, add authenticated users, server-enforced RBAC/ABAC, tenant isolation, rate limits, robust prompt-injection defenses, secret management, and human approval tied to authenticated identities. Never give agents unrestricted tools or database credentials.
