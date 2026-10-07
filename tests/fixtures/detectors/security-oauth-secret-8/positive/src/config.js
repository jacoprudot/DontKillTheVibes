// Acme web app — OAuth configuration for the Acme identity provider.
// TODO(jdoe): rotate these credentials, they were committed by mistake.
export const oauthConfig = {
  client_id: "acme-web-app",
  client_secret: "xK9#mQ2$vL7&pR4!",
  oauth_token: "ya29.a0AfH6SMBx1y2z3w4v5u6t7",
  redirect_uri: "https://app.acme.example/oauth/callback",
};

export function authHeaders() {
  return { Authorization: `Bearer ${oauthConfig.oauth_token}` };
}
