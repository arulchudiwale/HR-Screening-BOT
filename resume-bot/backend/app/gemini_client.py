import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def call_gemini_api(prompt: str) -> str:
    if not GEMINI_API_KEY:
        return "[Error: GEMINI_API_KEY is not set in environment variables]"

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }
    params = {
        "key": GEMINI_API_KEY
    }

    try:
        response = requests.post(url, headers=headers, params=params, json=payload, timeout=30)
        response.encoding = "utf-8"  # Ensure unicode support
        print("Gemini API raw response:", response.text)  # For backend debugging/audit
        response.raise_for_status()
        result = response.json()

        candidates = result.get("candidates", [])
        if (
            not candidates
            or "content" not in candidates[0]
            or not candidates[0]["content"].get("parts")
            or "text" not in candidates[0]["content"]["parts"][0]
        ):
            return "[Error: Unexpected Gemini response structure]"

        return candidates[0]["content"]["parts"][0]["text"]

    except requests.exceptions.HTTPError as http_err:
        return f"[HTTP error from Gemini API: {http_err}]"
    except Exception as e:
        return f"[Error calling Gemini API: {str(e)}]"
