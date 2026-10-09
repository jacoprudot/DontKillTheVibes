"""security-debug-in-prod-1 NEGATIVE — the shape that produced 10 of the rule's 10
sweep hits. The pre-2026-10-08 pattern `DEBUG\\s*=\\s*['\"]?1` was unanchored, so it
matched the SUBSTRING `DEBUG=1` inside a longer identifier anywhere on any line,
including documentation and comments. The pattern is now anchored to the start of a
line and requires the key to be exactly DEBUG / app.debug / NEXT_PUBLIC_*DEBUG.
"""


def log_debug(message):
    """Log debug message to stderr (enabled by --debug / LAST30DAYS_DEBUG=1)."""
    print(message)


# EVLOG_TELEMETRY_DEBUG=1 pnpm run cli -- doctor
def read_debug_flag():
    return os.environ.get("TOKENTRACKER_DEBUG", "0")
