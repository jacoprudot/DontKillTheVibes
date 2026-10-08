# code-sql-injection-risk-4 positive: one query is built by string concatenation, one by an
# f-string with an UNQUOTED placeholder and one by an f-string with a QUOTED placeholder, so
# this file MUST fire. The quoted-placeholder line is the shape defect 2 missed: the segment
# between the SQL keyword and the placeholder refused to cross the quote before it, so an
# f-string that interpolates a QUOTED placeholder — the most common shape in Python — measured 0.
import sqlite3


def find_user_by_email(conn: sqlite3.Connection, email: str):
    query = "SELECT id, email FROM users WHERE email = '" + email + "'"
    return conn.execute(query).fetchone()


def find_user_by_id(conn: sqlite3.Connection, user_id: str):
    return conn.execute(f"SELECT * FROM users WHERE id = '{user_id}'").fetchone()


def delete_sessions(conn: sqlite3.Connection, user_id: str):
    conn.execute(f"DELETE FROM sessions WHERE user_id = {user_id}")
