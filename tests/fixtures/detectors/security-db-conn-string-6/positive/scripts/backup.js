#!/usr/bin/env node
// Nightly dump task: connects to Redis to queue the backup job.
const redis = require('redis');

const client = redis.createClient({
  url: 'redis://default:r4nd0mTok3n@redis.svc.internal:6379/0',
});

client.connect().then(() => {
  console.log('backup queue connected');
  return client.quit();
});
