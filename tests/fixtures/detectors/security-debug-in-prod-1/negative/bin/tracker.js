// security-debug-in-prod-1 NEGATIVE — a runtime flag set from a CLI argument is
// not a production debug default (verbatim shape from the sweep: bin/tracker.js).
const debug = process.argv.includes('--debug');
if (debug) process.env.TOKENTRACKER_DEBUG = '1';

// A DIFFERENT key that merely ENDS in DEBUG must stay quiet.
export const EVLOG_TELEMETRY_DEBUG = '1';

module.exports = { debug };
