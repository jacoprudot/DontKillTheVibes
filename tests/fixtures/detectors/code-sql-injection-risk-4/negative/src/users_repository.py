# code-sql-injection-risk-4 negative: the query is parameterised and the only `+` concatenation is a greeting, so it must NOT fire; a naive "SELECT near a + or {" scan would flag it.
import sqlite3


def find_user_by_email(conn: sqlite3.Connection, email: str):
    return conn.execute(
        "SELECT id, email FROM users WHERE email = ?", (email,)
    ).fetchone()


def greet(name: str) -> str:
    return "Hello, " + name + "!"
