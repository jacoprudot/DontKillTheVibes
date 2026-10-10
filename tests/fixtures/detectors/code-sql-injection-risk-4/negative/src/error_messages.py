# code-sql-injection-risk-4 negative (2026-10-09 adjudication regressions):
# the rule must require SQL SYNTAX around the keyword, not just the word plus an
# f-string placeholder. These are the exact false positives from the worklist
# (Jaco ids 28, 32, 60) — user-facing messages, not queries.


def delete_drafts(video_id: str):
    raise Exception(f"Failed to delete drafts for video {video_id}")


def describe(video_type: str, pipeline_id: str):
    print(f"Selected recording type: {video_type}")
    print(f"Check status with get_update(pipeline_id='{pipeline_id}')")


def describe_deletion(condition: list, db_name: str):
    # mentions DELETE but builds no query, interpolates nothing into SQL syntax
    return f"You deleted data that {condition} from the database {db_name}"
