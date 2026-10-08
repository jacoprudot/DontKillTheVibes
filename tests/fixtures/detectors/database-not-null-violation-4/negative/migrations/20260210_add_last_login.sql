-- database-not-null-violation-4 negative: the same column arrives with a DEFAULT, which is the safe pattern, so it must NOT fire; a naive `ADD COLUMN ... NOT NULL` scan without the DEFAULT exemption would flag it.
ALTER TABLE sessions ADD COLUMN revoked_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NOT NULL DEFAULT now();
CREATE INDEX idx_users_last_login_at ON users (last_login_at);
