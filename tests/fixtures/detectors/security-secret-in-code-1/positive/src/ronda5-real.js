// security-secret-in-code-1 POSITIVE — ronda 5 (2026-10-15) MUST-SURVIVE:
// realistic credential shapes that must KEEP firing through the noise policy.
// All values are invented random strings in the SHAPE of the adjudicated REALS
// (long vendor-length API key, hex session secret, webhook token, query-string password).
// No vendor prefix on purpose: committed fixtures must not trip host secret scanning.
const api_key = "K7mQ2vL8zR4tY9nB3xW6cF0hDkP1sN8aE5gH2jM4cVbXwZ";
const api_key = "K7mQ2vL8zR4tY9nB3xW6cF0hDkP1sN8aE5gH2jM4cVbXwZ";
const session_secret = "a94f8e2b7c15d40386f2a9c7e3b1d580";
const client_secret = "b7e3f9a2c41d8e6f0a35c7b2d9e4f81a6c3d5e7f90a2b4c";
const webhook_token = "l/UrZGNHj5a7EK4UxP2w8zQf0b3nVc6W1e9hDkLmNoY";
const db_token_url = "https://svc.internal/cb?pwd=Xw3Kp9mQ2vL8z+R7tY4nB&mode=1";
export const creds = { api_key, session_secret, client_secret, webhook_token, db_token_url };
