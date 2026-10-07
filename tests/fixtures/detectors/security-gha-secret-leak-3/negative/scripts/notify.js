const secret = process.env.WEBHOOK_SECRET;
if (!secret) throw new Error('WEBHOOK_SECRET is required');

fetch('https://hooks.example.com/deploy', {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
});
