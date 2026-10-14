import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { api } from "./api/client";
import { AuthProvider } from "./auth/AuthProvider";

const user = { id: "1", name: "Ada Admin", email: "ada@example.com", role: "admin" };
const session = (token = "access-1") => ({ accessToken: token, user });
const response = (status, data) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve({ data }) });
const errorResponse = (status, message = "Unauthorized") => Promise.resolve({ status, ok: false, json: () => Promise.resolve({ error: { message } }) });
const renderApp = () => render(<AuthProvider><App /></AuthProvider>);

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

test("restores a session from the HTTP-only cookie on startup", async () => {
  fetch.mockReturnValueOnce(response(200, session())); renderApp();
  expect(screen.getByRole("status")).toHaveTextContent("Restoring your session");
  expect(await screen.findByText(/Welcome back, Ada Admin/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/refresh$/), expect.objectContaining({ method: "POST", credentials: "include" }));
});

test("shows login when startup refresh fails", async () => {
  fetch.mockReturnValueOnce(errorResponse(401, "Refresh session is missing")); renderApp();
  expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
});

test("recovers an expired access token and retries the request", async () => {
  fetch.mockReturnValueOnce(response(200, session("expired"))).mockReturnValueOnce(errorResponse(401)).mockReturnValueOnce(response(200, session("renewed"))).mockReturnValueOnce(response(200, { items: [] }));
  renderApp(); await screen.findByText(/Welcome back, Ada Admin/); fireEvent.click(screen.getByRole("button", { name: /administration/i }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
  expect(fetch.mock.calls[3][1].headers.Authorization).toBe("Bearer renewed");
});

test("signs out when recovery refresh fails", async () => {
  fetch.mockReturnValueOnce(response(200, session("expired"))).mockReturnValueOnce(errorResponse(401)).mockReturnValueOnce(errorResponse(401, "Session expired"));
  renderApp(); await screen.findByText(/Welcome back, Ada Admin/); fireEvent.click(screen.getByRole("button", { name: /administration/i }));
  expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
});

test("logout clears the in-memory session", async () => {
  fetch.mockReturnValueOnce(response(200, session())).mockReturnValueOnce(response(204)); renderApp();
  await screen.findByText(/Welcome back, Ada Admin/); fireEvent.click(screen.getByTitle("Sign out"));
  expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  expect(fetch.mock.calls[1][0]).toMatch(/\/auth\/logout$/);
});

test("concurrent 401 responses share one refresh-token rotation", async () => {
  fetch.mockReturnValueOnce(response(200, session("expired"))); renderApp(); await screen.findByText(/Welcome back, Ada Admin/);
  let releaseRefresh;
  const refresh = new Promise((resolve) => { releaseRefresh = () => resolve(response(200, session("renewed"))); });
  fetch.mockReturnValueOnce(errorResponse(401)).mockReturnValueOnce(errorResponse(401)).mockReturnValueOnce(refresh).mockReturnValueOnce(response(200, { value: 1 })).mockReturnValueOnce(response(200, { value: 2 }));
  const requests = [api("/one"), api("/two")];
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4)); releaseRefresh();
  await expect(Promise.all(requests)).resolves.toEqual([{ value: 1 }, { value: 2 }]);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(2);
});
