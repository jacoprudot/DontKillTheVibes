import express from 'express';
import cors from 'cors';

const app = express();

// Open CORS: any website can call this API from the browser.
app.use(cors({ origin: '*' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('API listening on :3000');
});
