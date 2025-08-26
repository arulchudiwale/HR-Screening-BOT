from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from app.file_parser import parse_resume
from app.helper import process_resume_batch
from app.models import EvaluationResponse
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # [PROD: Replace with your domain or trusted origins]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/evaluate", response_model=EvaluationResponse, tags=["Resume Screening"])
async def evaluate(
    request: Request,
    jd: UploadFile = File(..., description="JD file (.pdf, .docx)"),
    resumes: list[UploadFile] = File(..., description="Resume files (.pdf, .docx)"),
    remarkStyle: str = Form(..., description="Remark style (Professional, Friendly, etc.)"),
    weights: str = Form(..., description="Scoring Weights JSON (skills, experience, education, industry)")
):
    """
    Evaluate a batch of resumes against the uploaded job description.
    Returns detailed evaluation including any AI-based rejections with explainability.
    """
    try:
        print(f"API call from {request.client.host} UA: {request.headers.get('user-agent')}")

        # JD file read and validation
        jd_bytes = await jd.read()
        if not jd_bytes or len(jd_bytes) < 20:
            return EvaluationResponse(success=False, data=None, error="Uploaded JD file is empty or too small.")

        jd_text = parse_resume(jd_bytes, jd.filename)
        if not jd_text or jd_text.startswith("[Error") or jd_text.startswith("[Unsupported") or len(jd_text.strip()) < 10:
            return EvaluationResponse(success=False, data=None, error=f"Could not process JD file: {jd_text}")

        # Parse weights
        try:
            weights_dict = json.loads(weights)
            for key in ["skills", "experience", "education", "industry"]:
                if key not in weights_dict:
                    return EvaluationResponse(success=False, data=None, error=f"Weight for '{key}' missing.")
            weights_dict = {k: float(v) for k, v in weights_dict.items()}
            sum_w = sum(weights_dict.values())
            if abs(sum_w - 100) > 1:
                return EvaluationResponse(success=False, data=None, error=f"Sum of weights must be 100. Got {sum_w}.")
        except Exception as we:
            return EvaluationResponse(success=False, data=None, error=f"Invalid weights data: {str(we)}")

        if not resumes or len(resumes) < 1:
            return EvaluationResponse(success=False, data=None, error="No resumes uploaded.")

        # NOTE: No extraRules argument — call helper as originally designed
        results = await process_resume_batch(resumes, jd_text, weights_dict, remarkStyle)

        # For debugging: log the structure being returned (can remove in PROD)
        print("FINAL DATA TO FRONTEND:\n", json.dumps(results, indent=2, ensure_ascii=False))

        return EvaluationResponse(success=True, data=results)

    except Exception as e:
        print(f"Internal server error: {e}")
        return EvaluationResponse(success=False, data=None, error=f"Unexpected server error: {str(e)}")
# app/main.py
import os
import time
import json

from fastapi import FastAPI, UploadFile, File, Form, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.file_parser import parse_resume
from app.helper import process_resume_batch
from app.models import EvaluationResponse

# NEW: auth + logging
from app.auth import (
    LoginRequest,
    verify_login,
    issue_token,
    current_user,
    admin_required,
    AuthedUser,
)
from app.log_store import log_event, fetch_logs

app = FastAPI()

# --- CORS (use env ALLOWED_ORIGINS, default "*") ---
# Example: ALLOWED_ORIGINS="http://localhost:3000,https://yourapp.vercel.app"
_allowed = os.getenv("ALLOWED_ORIGINS", "*")
_allow_list = ["*"] if _allowed.strip() == "*" else [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# AUTH ENDPOINT
# ---------------------------
@app.post("/auth/login")
def login(body: LoginRequest):
    u = verify_login(body)
    if not u:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = issue_token(u.username, u.role)
    return {"token": token, "user": {"username": u.username, "role": u.role}}

# ---------------------------
# ADMIN LOGS (admin-only)
# ---------------------------
@app.get("/admin/logs")
def admin_logs(limit: int = 200, offset: int = 0, user: AuthedUser = Depends(admin_required)):
    return {"items": fetch_logs(limit=limit, offset=offset)}

# ---------------------------
# EVALUATE (auth-required)
# ---------------------------
@app.post("/evaluate", response_model=EvaluationResponse, tags=["Resume Screening"])
async def evaluate(
    request: Request,
    jd: UploadFile = File(..., description="JD file (.pdf, .docx)"),
    resumes: list[UploadFile] = File(..., description="Resume files (.pdf, .docx)"),
    remarkStyle: str = Form(..., description="Remark style (Professional, Friendly, etc.)"),
    weights: str = Form(..., description="Scoring Weights JSON (skills, experience, education, industry)"),
    user: AuthedUser = Depends(current_user),   # <-- NEW: require JWT
):
    """
    Evaluate a batch of resumes against the uploaded job description.
    Returns detailed evaluation including any AI-based rejections with explainability.
    """
    start = time.time()
    ok = False
    try:
        print(f"API call from {request.client.host} UA: {request.headers.get('user-agent')}")

        # JD file read and validation
        jd_bytes = await jd.read()
        if not jd_bytes or len(jd_bytes) < 20:
            return EvaluationResponse(success=False, data=None, error="Uploaded JD file is empty or too small.")

        jd_text = parse_resume(jd_bytes, jd.filename)
        if not jd_text or jd_text.startswith("[Error") or jd_text.startswith("[Unsupported") or len(jd_text.strip()) < 10:
            return EvaluationResponse(success=False, data=None, error=f"Could not process JD file: {jd_text}")

        # Parse weights
        try:
            weights_dict = json.loads(weights)
            for key in ["skills", "experience", "education", "industry"]:
                if key not in weights_dict:
                    return EvaluationResponse(success=False, data=None, error=f"Weight for '{key}' missing.")
            weights_dict = {k: float(v) for k, v in weights_dict.items()}
            sum_w = sum(weights_dict.values())
            if abs(sum_w - 100) > 1:
                return EvaluationResponse(success=False, data=None, error=f"Sum of weights must be 100. Got {sum_w}.")
        except Exception as we:
            return EvaluationResponse(success=False, data=None, error=f"Invalid weights data: {str(we)}")

        if not resumes or len(resumes) < 1:
            return EvaluationResponse(success=False, data=None, error="No resumes uploaded.")

        # NOTE: No extraRules argument — call helper as originally designed
        results = await process_resume_batch(resumes, jd_text, weights_dict, remarkStyle)

        # For debugging: log the structure being returned (can remove in PROD)
        print("FINAL DATA TO FRONTEND:\n", json.dumps(results, indent=2, ensure_ascii=False))

        ok = True
        return EvaluationResponse(success=True, data=results)

    except Exception as e:
        print(f"Internal server error: {e}")
        return EvaluationResponse(success=False, data=None, error=f"Unexpected server error: {str(e)}")

    finally:
        # Log the evaluation attempt (always runs)
        try:
            duration_ms = int((time.time() - start) * 1000)
            filenames = [f.filename for f in (resumes or [])]
            log_event(
                username=user.username if user else None,
                role=user.role if user else None,
                action="evaluate",
                success=ok,
                duration_ms=duration_ms,
                meta={
                    "client_ip": request.client.host if request and request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    "jd_filename": jd.filename if jd else None,
                    "resume_count": len(resumes) if resumes else 0,
                    "resume_filenames": filenames,
                    "remarkStyle": remarkStyle,
                    "weights_sum": sum(json.loads(weights).values()) if weights else None,
                },
            )
        except Exception as _log_err:
            # don't fail the request if logging has an issue
            print(f"[log_event error] {_log_err}")
