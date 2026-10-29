from pydantic import BaseModel, Field
from typing import Literal

class TaskCreate(BaseModel):
    objective: str = Field(min_length=8, max_length=4000)
    department: str = Field(default="General", max_length=100)

class ApprovalRequest(BaseModel):
    decision: Literal["approve", "reject"]
    comment: str = Field(default="", max_length=1000)
