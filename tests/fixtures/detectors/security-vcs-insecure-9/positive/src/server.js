'use strict';

const express = require('express');
const logger = require('internal-logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  logger.info(`dashboard listening on :${PORT}`);
});
