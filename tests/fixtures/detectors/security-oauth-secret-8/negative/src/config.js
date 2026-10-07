// Acme web app — OAuth credentials come from the environment, never from source.
// Provision them via the deployment secret store (see docs/development/oauth.md).
export const oauthConfig = {
  clientId: process.env.OAUTH_CLIENT_ID,
  redirectUri: process.env.OAUTH_REDIRECT_URI || "https://app.acme.example/oauth/callback",
  get clientSecret() {
    if (!process.env.OAUTH_CLIENT_SECRET) {
      throw new Error("OAUTH_CLIENT_SECRET is not set");
    }
    return process.env.OAUTH_CLIENT_SECRET;
  },
  get token() {
    return process.env.OAUTH_TOKEN;
  },
};

export function authHeaders() {
  return { Authorization: `Bearer ${oauthConfig.token}` };
}
