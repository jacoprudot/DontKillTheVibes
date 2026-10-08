-- database-not-null-violation-4 positive: an existing table gains a NOT NULL column with no DEFAULT, so this file MUST fire.
ALTER TABLE sessions ADD COLUMN revoked_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NOT NULL;
CREATE INDEX idx_users_last_login_at ON users (last_login_at);
