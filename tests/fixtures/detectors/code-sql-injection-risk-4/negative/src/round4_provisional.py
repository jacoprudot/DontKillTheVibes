# code-sql-injection-risk-4 negative (ronda 4, 2026-10-13 version_audit): the
# four corpus-backed FALSE classes the widened exclude_line_pattern removes.
# Each shape NAMES the adjudicated corpus repo it regresses. Every line below
# MATCHES the rule's pattern and is vetoed by the exclusion — this file must
# NOT fire. FN-safe contract (probe temp/probe-r4.mjs): the uber__ADR/databricks
# adjudicated REALS (bare {table_name}, {data['table']}, {table_ref}) carry no
# bind evidence and no enumerated concat operand, so they still fire.
import sqlite3


def insert_docstring_example() -> str:
    # uber__ADR sql_toolkit.py:37 (id 57): a DOCSTRING describing an insert,
    # with a documented dict example after `e.g.` — `e.g.` may carry whitespace
    # before the quote or brace.
    return """
    Args:
         items (dict[str, str | float | int]): The keys and values of data to insert into the database. e.g. {"id": 1, "name": "John"}
    """


def sync_status_sample(query_d1, d1_only):
    # doobidoo sync_status.py:205 (id 26): `{h}` is a single-letter INTERNAL
    # loop variable (a content hash from the repo's own index), not input.
    for h in list(d1_only)[:3]:
        result = query_d1(f"SELECT substr(content, 1, 50) as c FROM memories WHERE content_hash = '{h}'")
        yield result


def recall_time_based(conn: sqlite3.Connection, time_where: str, n_results: int):
    # doobidoo cloudflare.py:1992 (id 30): `{time_where}` is a where-family
    # INTERNAL fragment and the line carries a bind marker (`LIMIT ?`) — the
    # interpolation is not the unguarded input.
    sql = f"SELECT * FROM memories WHERE {time_where} ORDER BY created_at DESC LIMIT ?"
    return conn.execute(sql, (n_results,))


def truncate_table(db, tbl):
    # szczyglis-dev py-gpt storage.py:811 (id 49): string concat ending in an
    # enumerated INTERNAL table variable (`tbl` is the function's own table
    # name). PROVISIONAL clause: a line regex cannot see data flow; enumerated
    # names until an origin mechanism exists (see detectors.json note).
    query = "DELETE FROM " + tbl
    db.execute(query)
