# code-generic-catch-2 negative (python): the handler catches the project's own OrderImportError, so it must NOT fire; a naive `except .*Exception` scan would flag it.
import logging

logger = logging.getLogger(__name__)


class OrderImportError(Exception):
    """Raised when an order file cannot be parsed."""


def import_orders(path: str) -> list:
    try:
        with open(path) as fh:
            return [line.strip() for line in fh if line.strip()]
    except OrderImportError as e:
        logger.error("order import failed: %s", e)
        return []
