import re

# Demo-only rule. Replace with versioned policies and authenticated approvals.
SENSITIVE_PATTERNS = [
    r"\bdelete\b", r"\btransfer\b", r"\bpayment\b", r"\bpayroll\b",
    r"\bsalary\b", r"\bpersonal data\b", r"\bproduction system\b",
    r"\bchange permissions\b", r"\bcredentials\b",
]

def evaluate_objective(objective: str) -> dict:
    matches = [p for p in SENSITIVE_PATTERNS if re.search(p, objective, re.I)]
    if matches:
        return {
            "allowed": False,
            "requires_approval": True,
            "reason": "Potentially sensitive action detected; human approval is required.",
            "matched_rules": matches,
        }
    return {
        "allowed": True,
        "requires_approval": False,
        "reason": "No demo sensitive-action rule matched.",
        "matched_rules": [],
    }
