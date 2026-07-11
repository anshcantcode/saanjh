from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import json
import sqlite3
from typing import Any, Iterator, Mapping, Sequence
from uuid import uuid4

from .config import get_settings


TABLES = {
    "companions": frozenset(),
    "moods": frozenset(),
    "journal_entries": frozenset(),
    "sessions": frozenset({"companion_id"}),
    "messages": frozenset({"session_id"}),
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | str | None = None) -> str:
    if value is None:
        return utc_now().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _table(name: str) -> str:
    if name not in TABLES:
        raise ValueError(f"Unsupported table: {name}")
    return name


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database() -> None:
    with connection() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS companions (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS moods (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                companion_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS sessions_companion_idx
                ON sessions(companion_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS messages_session_idx
                ON messages(session_id, created_at ASC);

            PRAGMA user_version = 1;
            """
        )


def database_is_ready() -> bool:
    try:
        with connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS count FROM sqlite_master "
                "WHERE type = 'table' AND name IN "
                "('companions', 'moods', 'journal_entries', 'sessions', 'messages')"
            ).fetchone()
            return bool(row and row["count"] == 5)
    except sqlite3.Error:
        return False


def _decode(row: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(row["payload_json"])
    if not isinstance(payload, dict):
        raise RuntimeError("Stored record payload is invalid.")
    payload["id"] = row["id"]
    payload["created_at"] = row["created_at"]
    payload["updated_at"] = row["updated_at"]
    for extra in ("companion_id", "session_id"):
        if extra in row.keys():
            payload[extra] = row[extra]
    return payload


def insert_record(
    table: str,
    payload: Mapping[str, Any],
    *,
    record_id: str | None = None,
    created_at: datetime | str | None = None,
    extra: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    table = _table(table)
    extra = dict(extra or {})
    unsupported = set(extra).difference(TABLES[table])
    if unsupported:
        raise ValueError(f"Unsupported indexed columns for {table}: {sorted(unsupported)}")

    identifier = record_id or uuid4().hex
    timestamp = _iso(created_at)
    columns = ["id", *extra.keys(), "payload_json", "created_at", "updated_at"]
    values: list[Any] = [
        identifier,
        *extra.values(),
        json.dumps(dict(payload), ensure_ascii=False, separators=(",", ":")),
        timestamp,
        timestamp,
    ]
    placeholders = ", ".join("?" for _ in columns)
    sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
    with connection() as conn:
        conn.execute(sql, values)
    record = get_record(table, identifier)
    if record is None:
        raise RuntimeError("Stored record could not be read back.")
    return record


def get_record(table: str, record_id: str) -> dict[str, Any] | None:
    table = _table(table)
    with connection() as conn:
        row = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (record_id,)).fetchone()
    return _decode(row) if row else None


def list_records(
    table: str,
    *,
    limit: int,
    offset: int,
    where: Mapping[str, str] | None = None,
    ascending: bool = False,
) -> list[dict[str, Any]]:
    table = _table(table)
    where = dict(where or {})
    unsupported = set(where).difference(TABLES[table])
    if unsupported:
        raise ValueError(f"Unsupported filters for {table}: {sorted(unsupported)}")
    clauses = [f"{column} = ?" for column in where]
    sql = f"SELECT * FROM {table}"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += f" ORDER BY created_at {'ASC' if ascending else 'DESC'}, id {'ASC' if ascending else 'DESC'} LIMIT ? OFFSET ?"
    params: Sequence[Any] = (*where.values(), limit, offset)
    with connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_decode(row) for row in rows]


def update_record(table: str, record_id: str, payload: Mapping[str, Any]) -> dict[str, Any] | None:
    table = _table(table)
    timestamp = _iso()
    with connection() as conn:
        cursor = conn.execute(
            f"UPDATE {table} SET payload_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(dict(payload), ensure_ascii=False, separators=(",", ":")), timestamp, record_id),
        )
        changed = cursor.rowcount > 0
    return get_record(table, record_id) if changed else None


def delete_record(table: str, record_id: str) -> bool:
    table = _table(table)
    with connection() as conn:
        cursor = conn.execute(f"DELETE FROM {table} WHERE id = ?", (record_id,))
        return cursor.rowcount > 0
