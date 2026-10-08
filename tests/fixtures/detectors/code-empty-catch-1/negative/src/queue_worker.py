# code-empty-catch-1 negative (python): `except OSError as e:` handles the failure, so it must NOT fire; only `except ...: pass` does.
import json
from pathlib import Path


def load_queue(path: str) -> list:
    try:
        return json.loads(Path(path).read_text())
    except OSError as e:
        print(f"queue file unreadable, starting empty: {e}")
        return []
