# security-debug-in-prod-1 negative (2026-10-09 adjudication, Jaco id 217):
# DEBUG=True inside an integration-test settings module is test scaffolding,
# not a production debug flag. integration_test/ is a declared noise segment
# for the credential path policy, so this must NOT fire.
DEBUG = True
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
