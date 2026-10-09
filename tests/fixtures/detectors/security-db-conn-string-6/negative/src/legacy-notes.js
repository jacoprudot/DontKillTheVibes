// security-db-conn-string-6 NEGATIVE — the shapes the credential policy excludes
// for this spec. The regex is `scheme://user:password@`, so each line below
// MATCHES; the policy is what keeps it quiet.
//
// (1) localhost test credentials: the password is a placeholder word. Verbatim
//     shape from the sweep (`mongodb://root:secret@127.0.0.1:27017/lithe_test`).
const local = 'mongodb://root:secret@127.0.0.1:27017/lithe_test';

// (2) an inline `#nosec` annotation on a high-entropy password.
const internal = 'redis://default:r4nd0mTok3nX7@redis.svc.internal:6379/0'; // #nosec — a documentation sample

// (3) a value equal to its own key name: the key on the line is `url`, the
//     password is `url`, so the equals-key test is what silences this line.
const url = 'postgres://url:url@db.internal.example.com:5432/appdb';

module.exports = { local, internal, url };
