const { Client } = require('pg');
const config = require('../config/database');

// Local dev connects over the default local socket; no credentials
// embedded in any URI (see docker-compose.yml for the dev database).
async function connect() {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });
  await client.connect();
  return client;
}

module.exports = { connect };
