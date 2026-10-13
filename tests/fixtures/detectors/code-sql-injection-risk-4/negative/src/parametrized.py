# code-sql-injection-risk-4 negative (ronda 3, 2026-10-12 adjudication): the
# interpolated fragments are NOT user-driven values — they are bind-placeholder
# lists, internal constants and bound parameters. exclude_line_pattern removes
# exactly these line shapes. Each function names the adjudicated corpus repo it
# regresses (doobidoo, waku-agent). This file must NOT fire.
#
# DECLARED RESIDUAL (not in this fixture because the line regex cannot kill it
# without killing adjudicated REALS): inline identifier joins of the shape
# "SET {', '.join(F)} WHERE id = ?" — corpus falso in doobidoo__mcp-memory-service,
# kept firing by decision.

import sqlite3


def delete_by_ids(conn: sqlite3.Connection, memory_ids: list[int]):
    placeholders = ','.join('?' * len(memory_ids))
    conn.execute(f'DELETE FROM memory_embeddings WHERE rowid IN ({placeholders})', memory_ids)


_UNTAGGED_PREDICATE = "deleted_at IS NULL AND tags = ''"


def untagged(conn: sqlite3.Connection):
    conn.execute(f'UPDATE memories SET deleted_at = ? WHERE {_UNTAGGED_PREDICATE}', (1,))


def page(conn: sqlite3.Connection, limit: int, offset: int):
    rows = conn.execute('SELECT content_hash FROM memories LIMIT ? OFFSET ?', (limit, offset)).fetchall()
    return rows


def count_table(conn: sqlite3.Connection, table: str):
    # adjudicated FALSE in the corpus (electric-capital, hugoguerrap): an
    # internal config table name in identifier position, no user input
    return conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()
