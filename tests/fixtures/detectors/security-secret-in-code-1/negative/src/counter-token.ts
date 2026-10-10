// Negative fixtures, GLM ronda 2 §5.3, ids 259/260: a variable NAMED `token`
// that is a pre-increment counter (`++deploymentRequest.current`) is not a
// credential. The value layer rejects `++…` as an operator application.
export class DeploymentRequest {
  current = 0;
}

const deploymentRequest = new DeploymentRequest();

export function nextToken(): number {
  const token = ++deploymentRequest.current;
  return token;
}

export function prevToken(): number {
  const token = --deploymentRequest.current;
  return token;
}
