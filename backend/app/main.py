from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from pymongo.errors import PyMongoError
from .config import settings
from .db import db, check_database, client
from .schemas import TaskCreate, ApprovalRequest
from .agents import AGENTS
from .orchestrator import create_task, public_doc, audit, approve_task

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.tasks.create_index("created_at")
        await db.audit_events.create_index("created_at")
        await db.audit_events.create_index("task_id")
    except Exception:
        pass
    yield
    await client.close()

app = FastAPI(title="AgentGov AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    try:
        await check_database()
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database connection failed")

@app.get("/api/agents")
async def list_agents():
    return AGENTS

@app.get("/api/policies")
async def list_policies():
    from .policy import SENSITIVE_PATTERNS
    return [{
        "id": "demo-sensitive-action-gate",
        "name": "Sensitive Action Approval Gate",
        "enabled": True,
        "description": "Keyword-based demonstration rule; sensitive tasks are held for review.",
        "patterns": SENSITIVE_PATTERNS,
    }]

@app.post("/api/tasks")
async def post_task(payload: TaskCreate):
    try:
        return await create_task(payload.objective, payload.department)
    except Exception as exc:
        print(f"Task creation failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="Task could not be completed. Check backend configuration and logs.")

@app.get("/api/tasks")
async def list_tasks():
    docs = await db.tasks.find().sort("created_at", -1).limit(100).to_list(length=100)
    return [public_doc(d) for d in docs]

@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")
    doc = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return public_doc(doc)

@app.post("/api/tasks/{task_id}/approve")
async def task_approval(task_id: str, payload: ApprovalRequest):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")
    try:
        result = await approve_task(task_id, payload.decision, payload.comment)
        if result is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

@app.get("/api/audit")
async def list_audit():
    docs = await db.audit_events.find().sort("created_at", -1).limit(200).to_list(length=200)
    return [public_doc(d) for d in docs]
