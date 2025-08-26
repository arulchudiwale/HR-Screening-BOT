from typing import List, Dict, Optional
from pydantic import BaseModel

class ResumeResult(BaseModel):
    filename: str
    name: str
    score: float
    experience_score: float
    skill_score: float
    education_score: float
    industry_score: float
    experience_summary: str
    education: str
    skills_matched: List[str]
    remark: str
    scorebreakdown: Dict[str, float]

    class Config:
        extra = "allow"

class EvaluationData(BaseModel):
    accepted: List[ResumeResult]
    rejected: List[ResumeResult]

class EvaluationResponse(BaseModel):
    success: bool
    data: Optional[EvaluationData]
    error: Optional[str] = None
