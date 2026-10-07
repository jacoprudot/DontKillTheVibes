import express from 'express';
import cors from 'cors';

const app = express();

// Restricted CORS: only our own frontends may call this API from the browser.
const allowedOrigins = [
  'https://app.example.com',
  'https://admin.example.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed'));
      }
    },
    credentials: true,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('API listening on :3000');
});
