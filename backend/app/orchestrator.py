
from datetime import datetime, timezone

from bson import ObjectId

from .db import db
from .agents import run_agent
from .policy import evaluate_objective
from .config import settings


AGENT_SEQUENCE = ["research", "analyst", "reviewer"]


# --------------------------------------------------
# Utilities
# --------------------------------------------------

def now():
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


def public_doc(doc):
    """Convert MongoDB documents into JSON-friendly dictionaries."""
    if not doc:
        return None

    result = dict(doc)

    if "_id" in result:
        result["_id"] = str(result["_id"])

    for key, value in result.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, ObjectId):
            result[key] = str(value)

    return result


async def audit(event: str, task_id: str, details=None):
    """Save an audit event to MongoDB."""
    await db.audit_logs.insert_one(
        {
            "event": event,
            "task_id": str(task_id),
            "details": details or {},
            "created_at": now(),
        }
    )


# --------------------------------------------------
# Demo agents
# --------------------------------------------------

async def run_demo_agent(agent_id: str, objective: str, context: str = ""):
    """
    Produce deterministic educational demo outputs.
    This function does not call Gemini or another external AI API.
    """

    text = objective.lower()

    financial_keywords = [
        "financial risk",
        "startup",
        "cash flow",
        "funding",
        "financial",
        "finance",
        "investment",
        "runway",
    ]

    complaint_keywords = [
        "complaint",
        "customer support",
        "customer service",
    ]

    if any(keyword in text for keyword in financial_keywords):

        if agent_id == "research":
            return """
[DEMO MODE — RESEARCH FINDINGS]

Objective: Assess potential financial risks.

Potential risk areas:
1. Cash flow and operating expenses.
2. Customer demand and revenue uncertainty.
3. AI, cloud, infrastructure, and vendor costs.
4. Data security, privacy, and compliance expenses.
5. Dependence on external service providers.

Information required for a real assessment:
- Recent financial statements.
- Monthly revenue and operating costs.
- Cash balance and liabilities.
- Customer retention and acquisition costs.
- Forecasts and funding commitments.

Limitations:
These findings are illustrative. No company-specific financial
records or external evidence were independently verified.
"""

        if agent_id == "analyst":
            return """
[DEMO MODE — ANALYST REPORT]

1. Cash burn and runway
Impact: HIGH
Risk: Expenses may exceed available cash.
Mitigation: Track monthly burn, maintain a cash forecast,
and establish spending limits.
Suggested metrics: Monthly burn rate, available cash,
and months of runway.

2. Customer demand and revenue
Impact: HIGH
Risk: Revenue may fall below projections.
Mitigation: Validate demand, monitor retention,
and review sales forecasts.
Suggested metrics: Monthly recurring revenue,
customer churn, and conversion rate.

3. Infrastructure and AI costs
Impact: MEDIUM-HIGH
Risk: Cloud usage and model inference costs may grow.
Mitigation: Set budgets, monitor usage, and optimize workloads.
Suggested metrics: Cost per request and monthly cloud spend.

4. Security, privacy, and compliance
Impact: HIGH
Risk: Incidents may create financial and legal exposure.
Mitigation: Apply access controls, data minimization,
security reviews, and appropriate compliance checks.
Suggested metrics: Open critical findings and incident count.

5. Vendor dependency
Impact: MEDIUM
Risk: Service outages or pricing changes may disrupt operations.
Mitigation: Review service agreements and prepare alternatives.
Suggested metrics: Availability, outage duration,
and vendor concentration.

Recommended next step:
Collect real financial data and score each risk using
likelihood, impact, and evidence quality.

These priorities are illustrative, not a verified financial forecast.
"""

        if agent_id == "reviewer":
            return """
[DEMO MODE — GOVERNANCE REVIEW]

Verdict: PASS WITH LIMITATIONS

Checks:
- Research, analysis, and recommendations are separated.
- Major assumptions and limitations are disclosed.
- Suggested metrics can be used for future monitoring.
- Recommendations require validation against real evidence.
- No financial transaction or external action was executed.

Required before relying on this report:
1. Verify the underlying financial data.
2. Assign risk owners and deadlines.
3. Have an authorized person review high-impact decisions.

Final status: Suitable for educational demonstration only.
"""

    if any(keyword in text for keyword in complaint_keywords):

        if agent_id == "research":
            return """
[DEMO MODE — CUSTOMER COMPLAINT RESEARCH]

Illustrative complaint categories:
- Delayed service or delivery.
- Billing or payment issues.
- Product or service quality.
- Account access problems.
- Poor customer support.

Real complaint records are required to establish actual frequencies.
"""

        if agent_id == "analyst":
            return """
[DEMO MODE — COMPLAINT ANALYSIS]

Suggested handling process:

1. Classify the complaint by category.
2. Assess severity and customer impact.
3. Identify the likely cause.
4. Recommend a response or corrective action.
5. Escalate safety, fraud, privacy, or urgent cases.

Suggested priorities:
- HIGH: Safety concerns, suspected fraud, or exposed personal data.
- MEDIUM: Repeated service failures or significant billing disputes.
- LOW: General feedback or minor service questions.

A human should review serious or disputed cases.
These categories are illustrative, not derived from actual records.
"""

        if agent_id == "reviewer":
            return """
[DEMO MODE — COMPLAINT GOVERNANCE REVIEW]

Verdict: PASS WITH LIMITATIONS

- Do not invent customer facts.
- Protect personally identifiable information.
- Escalate serious complaints for human review.
- Record decisions and outcomes for auditability.
- Do not send messages or issue refunds automatically.

No customer record was accessed and no external action was executed.
"""

    # Generic demo output
    if agent_id == "research":
        return f"""
[DEMO MODE — RESEARCH]

Objective:
{objective}

Initial assessment:
- Identify the objective and intended outcome.
- List relevant evidence and information requirements.
- Identify assumptions and missing information.

No external research was performed. Findings are illustrative.
"""

    if agent_id == "analyst":
        return f"""
[DEMO MODE — ANALYSIS]

Objective:
{objective}

Recommended approach:
1. Break the objective into measurable steps.
2. Identify risks, dependencies, and constraints.
3. Define success criteria.
4. Validate the results against reliable evidence.
5. Escalate high-impact decisions for human review.

The recommendations have not been independently verified.
"""

    return """
[DEMO MODE — GOVERNANCE REVIEW]

Verdict: PASS WITH LIMITATIONS

- Confirm the objective is clear and appropriate.
- Verify claims against reliable evidence.
- Document assumptions and limitations.
- Require human approval for sensitive decisions.
- Do not execute external actions in Demo Mode.

Evidence status: Illustrative, not independently verified.
"""


# --------------------------------------------------
# Create a task
# --------------------------------------------------

async def create_task(objective: str, department: str = "General"):
    """Create a task and run it if policy permits."""

    objective = objective.strip()

    if not objective:
        raise ValueError("Objective cannot be empty.")

    policy = evaluate_objective(objective)

    status = (
        "awaiting_approval"
        if policy["requires_approval"]
        else "queued"
    )

    task = {
        "objective": objective,
        "department": department,
        "status": status,
        "policy": policy,
        "agent_outputs": [],
        "final_result": "",
        "error": None,
        "created_at": now(),
        "updated_at": now(),
    }

    result = await db.tasks.insert_one(task)
    task_id = str(result.inserted_id)

    await audit(
        "task_created",
        task_id,
        {
            "department": department,
            "requires_approval": policy["requires_approval"],
        },
    )

    if status == "awaiting_approval":
        await audit(
            "approval_required",
            task_id,
            {"reason": policy},
        )
    else:
        await execute_task(task_id)

    saved_task = await db.tasks.find_one(
        {"_id": ObjectId(task_id)}
    )

    return public_doc(saved_task)


# --------------------------------------------------
# Execute the multi-agent workflow
# --------------------------------------------------

async def execute_task(task_id: str):
    """Run Research -> Analyst -> Reviewer when policy allows."""

    try:
        oid = ObjectId(task_id)
    except Exception:
        return None

    task = await db.tasks.find_one({"_id": oid})

    if not task:
        return None

    # Re-check policy immediately before execution.
    policy = evaluate_objective(task["objective"])

    if policy["requires_approval"]:
        await db.tasks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "awaiting_approval",
                    "policy": policy,
                    "updated_at": now(),
                }
            },
        )

        await audit(
            "execution_blocked",
            task_id,
            {"reason": "Human approval required"},
        )

        saved_task = await db.tasks.find_one({"_id": oid})
        return public_doc(saved_task)

    await db.tasks.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "running",
                "policy": policy,
                "error": None,
                "updated_at": now(),
            }
        },
    )

    await audit(
        "workflow_started",
        task_id,
        {
            "agents": AGENT_SEQUENCE,
            "mode": (
                "demo"
                if settings.agentgov_demo_mode
                else "live"
            ),
        },
    )

    outputs = []
    context = ""

    try:
        for agent_id in AGENT_SEQUENCE:

            # Demo Mode never calls the external AI provider.
            if settings.agentgov_demo_mode:
                result = await run_demo_agent(
                    agent_id,
                    task["objective"],
                    context,
                )
            else:
                result = await run_agent(
                    agent_id,
                    task["objective"],
                    context,
                )

            outputs.append(
                {
                    "agent_id": agent_id,
                    "output": result,
                    "created_at": now(),
                }
            )

            # Pass the previous agent's result to the next agent.
            context = result

            # Persist each agent output as soon as it completes.
            await db.tasks.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "agent_outputs": outputs,
                        "updated_at": now(),
                    }
                },
            )

            await audit(
                "agent_completed",
                task_id,
                {"agent_id": agent_id},
            )

        # Combine all three outputs into one final report.
        if settings.agentgov_demo_mode and len(outputs) == 3:
            research_output = outputs[0]["output"]
            analyst_output = outputs[1]["output"]
            reviewer_output = outputs[2]["output"]

            final_result = f"""
# AgentGov AI — Final Governance Report

## 1. Research Findings

{research_output}

## 2. Detailed Analysis and Recommendations

{analyst_output}

## 3. Governance Review

{reviewer_output}

---

**Mode:** Educational Demo  
**Evidence status:** Illustrative, not independently verified  
**External actions:** None executed
"""
        else:
            final_result = (
                outputs[-1]["output"] if outputs else ""
            )

        await db.tasks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "completed",
                    "agent_outputs": outputs,
                    "final_result": final_result,
                    "error": None,
                    "updated_at": now(),
                }
            },
        )

        await audit(
            "workflow_completed",
            task_id,
            {"agent_count": len(outputs)},
        )

    except Exception as exc:
        # Keep detailed exception messages in the backend console,
        # not in the user-facing task record.
        print(
            f"AgentGov workflow failed: {type(exc).__name__}: {exc}"
        )

        await db.tasks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "failed",
                    "error": (
                        "Agent workflow failed. Check backend "
                        "logs and API configuration."
                    ),
                    "updated_at": now(),
                }
            },
        )

        await audit(
            "workflow_failed",
            task_id,
            {"error_type": type(exc).__name__},
        )

        raise

    saved_task = await db.tasks.find_one({"_id": oid})
    return public_doc(saved_task)


# --------------------------------------------------
# Approve or reject a task
# --------------------------------------------------

async def approve_task(
    task_id: str,
    decision=None,
    actor: str = "admin",
    approved=None,
):
    """
    Record an approval decision.

    Sensitive tasks are NOT executed automatically, even when approved.
    This is an intentional MVP safety restriction.
    """

    try:
        oid = ObjectId(task_id)
    except Exception:
        return None

    task = await db.tasks.find_one({"_id": oid})

    if not task:
        return None

    if task.get("status") != "awaiting_approval":
        raise ValueError(
            "Only tasks awaiting approval can be reviewed."
        )

    if approved is not None:
        is_approved = bool(approved)
    elif isinstance(decision, bool):
        is_approved = decision
    else:
        is_approved = (
            str(decision).strip().lower()
            in {"approve", "approved", "yes", "true"}
        )

    await audit(
        "approval_decision",
        task_id,
        {
            "decision": "approved" if is_approved else "rejected",
            "actor": actor,
        },
    )

    if not is_approved:
        await db.tasks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "rejected",
                    "error": "Task rejected during human review.",
                    "updated_at": now(),
                }
            },
        )
    else:
        # Approval is recorded, but sensitive execution stays disabled.
        await db.tasks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "awaiting_approval",
                    "error": (
                        "Approval recorded, but execution is disabled "
                        "for sensitive tasks in this MVP. "
                        "No action was executed."
                    ),
                    "updated_at": now(),
                }
            },
        )

    saved_task = await db.tasks.find_one({"_id": oid})
    return public_doc(saved_task)
