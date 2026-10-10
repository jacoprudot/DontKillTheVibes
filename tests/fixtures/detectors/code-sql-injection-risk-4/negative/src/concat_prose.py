# Negative, GLM ronda 2 §5.1: string concatenation whose LEFT side names SQL
# keywords but is prose (an error/log message), not a query. The 2026-10-09
# branch-2 gate requires the SQL-keyword side to actually carry the query
# shape (SELECT…FROM / INSERT INTO / UPDATE…SET / DELETE FROM), which these
# lines do not.


def report_rows(count):
    print("Error: SELECT returned " + str(count) + " rows")


def report_delete(record_id):
    print("user asked to DELETE record " + record_id)


def report_update(name):
    print("UPDATE finished for user " + name)
