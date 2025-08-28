# app/log_store.py
import os, json, sqlite3
from datetime import datetime
from typing import List, Dict, Any
DB_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DB_DIR, exist_ok=True)
SQLITE_PATH = os.path.join(DB_DIR, "logs.db")

PG_URL = os.getenv("DATABASE_URL")

def _sqlite_conn():
    con = sqlite3.connect(SQLITE_PATH)
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

def _pg_conn():
    import psycopg2
    con = psycopg2.connect(PG_URL)
    with con:
        with con.cursor() as cur:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS logs (
              id SERIAL PRIMARY KEY,
              ts TIMESTAMPTZ NOT NULL,
              username TEXT,
              role TEXT,
              action TEXT,
              success BOOLEAN,
              duration_ms INTEGER,
              meta JSONB
            )
            """)
    return con

def _use_pg():
    return bool(PG_URL)

def log_event(username: str, role: str, action: str, success: bool, duration_ms: int, meta: Dict[str, Any]):
    if _use_pg():
        import psycopg2
        con = _pg_conn()
        try:
            with con:
                with con.cursor() as cur:
                    cur.execute(
                        "INSERT INTO logs (ts, username, role, action, success, duration_ms, meta) "
                        "VALUES (NOW(), %s, %s, %s, %s, %s, %s::jsonb)",
                        (username, role, action, success, duration_ms, json.dumps(meta))
                    )
        finally:
            con.close()
    else:
        con = _sqlite_conn()
        try:
            con.execute(
                "INSERT INTO logs (ts, username, role, action, success, duration_ms, meta) VALUES (?,?,?,?,?,?,?)",
                (datetime.utcnow().isoformat(), username, role, action, 1 if success else 0, duration_ms, json.dumps(meta)[:20000]),
            )
            con.commit()
        finally:
            con.close()

def fetch_logs(limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
    if _use_pg():
        con = _pg_conn()
        try:
            with con:
                with con.cursor() as cur:
                    cur.execute(
                        "SELECT ts, username, role, action, success, duration_ms, meta "
                        "FROM logs ORDER BY id DESC LIMIT %s OFFSET %s",
                        (limit, offset)
                    )
                    rows = cur.fetchall()
                    out = []
                    for r in rows:
                        ts, username, role, action, success, duration_ms, meta = r
                        out.append({
                            "ts": ts.isoformat(),
                            "username": username, "role": role, "action": action,
                            "success": bool(success), "duration_ms": duration_ms,
                            "meta": meta if isinstance(meta, dict) else (json.loads(meta) if meta else {})
                        })
                    return out
        finally:
            con.close()
    else:
        con = _sqlite_conn()
        try:
            cur = con.execute(
                "SELECT ts, username, role, action, success, duration_ms, meta "
                "FROM logs ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset)
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
