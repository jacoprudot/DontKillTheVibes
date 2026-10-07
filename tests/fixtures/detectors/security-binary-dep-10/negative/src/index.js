'use strict';

const { VERSION } = require('./version');

function createClient(apiKey, options = {}) {
  if (!apiKey) {
    throw new Error('apiKey is required');
  }
  const baseUrl = options.baseUrl || 'https://api.acme-analytics.io';
  return {
    version: VERSION,
    baseUrl,
    track(event, payload) {
      return { event, payload, sentAt: new Date().toISOString() };
    },
  };
}

module.exports = { createClient };
