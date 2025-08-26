import json
import re
from app.gemini_client import call_gemini_api

FORBIDDEN_COMPANIES = [
    r'jsw\s*paints?',
    r'jsw\b',
    r'dulux',
    r'akzo\s*nobel',
    r'birla\s*opus',
]
FORBIDDEN_COMPANY_REGEX = re.compile('|'.join(FORBIDDEN_COMPANIES), re.IGNORECASE)

# Utility: Always coerce a value to float (used for score)
def parse_float(val, default=0.0):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default

def extract_jd_summary(jd_text):
    expected_experience = ""
    required_education = ""
    key_skills = []
    exp_match = re.search(r"(?:[Ee]xpected\s+[Ee]xperience|[Ee]xperience\s+[Rr]equired)[:\-]?\s*([^\n\r.;]*)", jd_text)
    if exp_match:
        expected_experience = exp_match.group(1).strip()
    edu_match = re.search(r"(?:[Rr]equired\s+[Ee]ducation|[Ee]ducation)[:\-]?\s*([^\n\r.;]*)", jd_text)
    if edu_match:
        required_education = edu_match.group(1).strip()
    skills_match = re.search(r"(?:[Kk]ey\s+[Ss]kills|[Ss]kills\s+[Rr]equired)[:\-]?\s*([^\n\r.]+)", jd_text)
    if skills_match:
        skill_str = skills_match.group(1)
        key_skills = [s.strip() for s in re.split(r",|•|·|-", skill_str) if s.strip()]
    return {
        "expected_experience": expected_experience,
        "required_education": required_education,
        "key_skills": key_skills,
    }

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip() if text else ""

def build_prompt(jd_text, resume_text, weights, remark_type):
    prompt = f"""
You are acting as a professional HR Manager at JSW Paints.
Evaluate the following resume against the job description.

Scoring Logic:
1. Experience Match - {weights['experience']}%
2. Skill Match - {weights['skills']}%
3. Education Quality - {weights['education']}%
4. Industry relevance - {weights['industry']}%

Other Rules:
- Deduct 10% if experience < 2 years.
- Direct REJECTION if job-hopping <2 years occurred more than twice.
- Score 0 and mark as Rejected ONLY if the candidate's work history (company names in experience or education) directly and unambiguously mentions: JSW, Dulux, Akzo Nobel, or Birla Opus. Do NOT reject based on guesses, abbreviations, partial matches, or vague context.
- For evaluating colleges/universities use NIRF ranking.
- DO NOT reject candidates for working in Asian Paints.

IMPORTANT: When you reject, always quote the exact line/company/experience that triggers the rejection in your remark.
If you find NO such company in experience or education, do NOT reject for this rule.

Return ONLY JSON in this format:
{{
  "name": "Candidates name from resume/cv",
  "score": Final score out of 100,
  "score_breakdown": {{
      "experience": score_from_experience,
      "skills": score_from_skills,
      "education": score_from_education,
      "industry": score_from_industry
  }},
  "experience": "Total Experience and Relevant years and role/company breakdown",
  "education": "Highest education achieved or degree",
  "skills_matched": ["skills1", "skills2"],
  "remark": "30-word summary with Accept/Reject verdict, and cite which experience/company caused rejection if rejected"
}}

If any of these fields are missing, return "N/A", 0, or [] as appropriate.

Job Description:
\"\"\"
{jd_text}
\"\"\"

Candidate Resume:
\"\"\"
{resume_text}
\"\"\"
"""
    return prompt

def extract_json_from_codeblock(response_text):
    # Triple-backtick block, optionally with 'json'
    match = re.search(r"``````", response_text)
    if match:
        json_str = match.group(1)
    else:
        json_start = response_text.find('{')
        json_end = response_text.rfind('}')
        if json_start != -1 and json_end != -1:
            json_str = response_text[json_start:json_end + 1]
        else:
            raise ValueError("No valid JSON object found in Gemini response.")
    return json_str

def contains_forbidden_company(text):
    """Return the matched substring if forbidden company present, else None"""
    m = FORBIDDEN_COMPANY_REGEX.search(text)
    return m.group(0) if m else None

def evaluate_resume(jd_text, resume_text, weights, remark_type, filename):
    prompt = build_prompt(jd_text, resume_text, weights, remark_type)
    response_text = call_gemini_api(prompt)
    try:
        json_str = extract_json_from_codeblock(response_text)
        json_data = json.loads(json_str)

        # Robust field fetcher
        def get_field(d, *keys, default="N/A"):
            for k in keys:
                if k in d and d[k] not in [None, "", [], "N/A"]:
                    return d[k]
            return default

        name = get_field(json_data, "name", "Name")
        education = get_field(json_data, "education", "Education")
        experience = get_field(json_data, "experience", "Experience")
        remark = get_field(json_data, "remark", "Remark")

        # Handle skills as comma string or list
        skills = get_field(json_data, "skills_matched", "Skills_matched", default=[])
        if isinstance(skills, list):
            skills_list = skills
        elif isinstance(skills, str) and skills.strip():
            skills_list = [s.strip() for s in skills.split(",") if s.strip()]
        else:
            skills_list = []

        # Coerce score:
        score_val = parse_float(json_data.get("score", 0))

        # Score break
        score_breakdown = get_field(json_data, "score_breakdown", "Score_breakdown", default={})
        if not isinstance(score_breakdown, dict):
            score_breakdown = {"experience": 0, "skills": 0, "education": 0, "industry": 0}
        def safe_score(breakdown, key):
            return parse_float(breakdown.get(key, 0))

        # ========= Defensive AI validation: Confirm ex-JSW/forbidden claims =========
        resume_combined = (resume_text or "") + " " + (experience or "") + " " + (education or "")
        forbidden_found = contains_forbidden_company(resume_combined)

        # If Gemini claims rejected due to forbidden company, but no such company found in parsed text, override
        rejected_for_forbidden = False
        lower_remark = (remark or "").lower()
        if ("reject" in lower_remark or "rejected" in lower_remark) and (
            "jsw" in lower_remark or "dulux" in lower_remark or "akzo" in lower_remark or "birla" in lower_remark
        ):
            if not forbidden_found:
                # Defensive override!
                remark += " [Override: AI claimed ex-JSW/Akzo/Dulux/Birla but resume parsing found NO such company. Please review.]"
                # You may also consider: score_val = 60 (so they're not auto-rejected) or flag for manual review.
                rejected_for_forbidden = True

        result_dict = {
            "filename": filename,
            "name": name,
            "score": score_val,
            "experience_summary": experience,
            "education": education,
            "skills_matched": skills_list,
            "remark": remark,
            "experience_score": safe_score(score_breakdown, "experience"),
            "skill_score": safe_score(score_breakdown, "skills"),
            "education_score": safe_score(score_breakdown, "education"),
            "industry_score": safe_score(score_breakdown, "industry"),
            "scorebreakdown": score_breakdown,
        }

        print("RETURNING TO FRONTEND:", json.dumps(result_dict, indent=2))

        return result_dict

    except Exception as e:
        return {
            "filename": filename,
            "name": "N/A",
            "score": 0,
            "experience_summary": "N/A",
            "education": "N/A",
            "skills_matched": [],
            "remark": f"[Error parsing Gemini output: {str(e)}]",
            "experience_score": 0,
            "skill_score": 0,
            "education_score": 0,
            "industry_score": 0,
            "scorebreakdown": {"experience": 0, "skills": 0, "education": 0, "industry": 0},
        }

async def process_resume_batch(files, jd_text, weights, remark_type, threshold=60):
    accepted, rejected = [], []
    from io import BytesIO
    jd_summary = extract_jd_summary(jd_text)
    for file in files:
        filename = file.filename
        try:
            content = await file.read()
            if filename.lower().endswith(".pdf"):
                from PyPDF2 import PdfReader
                reader = PdfReader(BytesIO(content))
                resume_text = " ".join(page.extract_text() or "" for page in reader.pages)
            elif filename.lower().endswith(".docx"):
                from docx import Document
                doc = Document(BytesIO(content))
                resume_text = " ".join(para.text for para in doc.paragraphs)
            else:
                resume_text = content.decode(errors="ignore")
        except Exception as e:
            record = {
                "filename": filename,
                "name": "N/A",
                "score": 0,
                "education": "N/A",
                "experience_summary": "N/A",
                "skills_matched": [],
                "remark": f"[Error reading resume: {str(e)}]",
                "experience_score": 0,
                "skill_score": 0,
                "education_score": 0,
                "industry_score": 0,
                "scorebreakdown": {"experience": 0, "skills": 0, "education": 0, "industry": 0},
            }
            rejected.append(record)
            continue

        resume_text = clean_text(resume_text)
        result = evaluate_resume(jd_text, resume_text, weights, remark_type, filename)

        # Defensive: ensure score is always float (never a string)
        score_val = result.get("score", 0.0)
        try:
            score_val = float(score_val)
        except Exception:
            score_val = 0

        # (Optional: You could add other safe-guards or PT score floors here.)

        if score_val >= threshold:
            accepted.append(result)
        else:
            rejected.append(result)
    return {"accepted": accepted, "rejected": rejected, "jd_summary": jd_summary}
