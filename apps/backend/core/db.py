import os
from contextlib import contextmanager

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

_pool = ConnectionPool(
    os.environ["DATABASE_URL"],
    kwargs={"row_factory": dict_row},
    min_size=1,
    max_size=10,
    open=True,
)


@contextmanager
def db(user_id: str | None = None):
    """One transaction. Sets the RLS identity for its duration (SET LOCAL)."""
    with _pool.connection() as conn:
        conn.execute(
            "select set_config('app.current_user_id', %s, true)",
            (str(user_id) if user_id else "",),
        )
        yield conn


def query(sql: str, params: tuple = (), user_id: str | None = None) -> list[dict]:
    """Run a statement and return rows. Returns [] for statements without a result set."""
    with db(user_id) as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall() if cur.description else []


def execute(sql: str, params: tuple = (), user_id: str | None = None):
    """Run a statement; returns rows when it has a result set, otherwise None."""
    with db(user_id) as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall() if cur.description else None
