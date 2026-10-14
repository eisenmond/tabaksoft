const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api/v1";

let authBridge = { getAccessToken: () => null, onSession: () => {}, onSignOut: () => {} };
let refreshPromise = null;

export function configureAuth(bridge) { authBridge = bridge; }

async function readResponse(response) {
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "The request could not be completed");
  return body.data;
}

async function send(path, options = {}) {
  const token = authBridge.getAccessToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
}

// Serialize refresh-token rotation so concurrent 401 responses share one request.
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = send("/auth/refresh", { method: "POST" })
      .then(readResponse)
      .then((session) => { authBridge.onSession(session); return session; })
      .catch((error) => { authBridge.onSignOut(); throw error; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function api(path, options = {}) {
  const response = await send(path, options);
  if (response.status === 401 && !path.startsWith("/auth/")) {
    await refreshSession();
    return readResponse(await send(path, options));
  }
  return readResponse(response);
}
