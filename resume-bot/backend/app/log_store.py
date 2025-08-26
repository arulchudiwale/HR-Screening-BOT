# app/log_store.py
import os, json, sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "logs.db")

def _conn():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        username TEXT,
        role TEXT,
        action TEXT,
        success INTEGER,
        duration_ms INTEGER,
        meta TEXT
      )
    """)
    return con

def log_event(username: str, role: str, action: str, success: bool, duration_ms: int, meta: Dict[str, Any]):
    con = _conn()
    try:
        con.execute(
            "INSERT INTO logs (ts, username, role, action, success, duration_ms, meta) VALUES (?,?,?,?,?,?,?)",
            (datetime.utcnow().isoformat(), username, role, action, 1 if success else 0, duration_ms, json.dumps(meta)[:20000]),
        )
        con.commit()
    finally:
        con.close()

def fetch_logs(limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
    con = _conn()
    try:
        cur = con.execute(
            "SELECT ts, username, role, action, success, duration_ms, meta FROM logs ORDER BY id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = cur.fetchall()
        return [
            {
                "ts": r[0],
                "username": r[1],
                "role": r[2],
                "action": r[3],
                "success": bool(r[4]),
                "duration_ms": r[5],
                "meta": json.loads(r[6]) if r[6] else {}
            }
            for r in rows
        ]
    finally:
        con.close()
