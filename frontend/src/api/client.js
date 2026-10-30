// Shared API/session helpers.
// The keys intentionally match the original vanilla frontend so existing
// sessions in localStorage keep working.

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const ASSET_ORIGIN = (import.meta.env.VITE_ASSET_ORIGIN || '').replace(/\/+$/, '');

const TOKEN_KEY = 'caresync_token';
const USER_KEY = 'caresync_user';

export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || getCookie('token');
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function setCurrentUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Could not persist user profile:', error);
  }
}

export function getCurrentUser() {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

// Report files are served by Express at /uploads/... . In development the Vite
// proxy forwards that path; when the apps are deployed on different origins,
// VITE_ASSET_ORIGIN points at the API server.
export function assetUrl(filePath) {
  if (!filePath) return '#';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return `${ASSET_ORIGIN}${filePath}`;
}

// Central API wrapper: attaches the bearer token and redirects on expiry.
export async function apiFetch(path, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(fetchOptions.headers || {});
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (fetchOptions.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  // A 401 from the login endpoint means "wrong credentials", not an expired
  // session, so auth requests opt out of the redirect.
  if (response.status === 401 && !skipAuthRedirect) {
    clearSession();
    window.location.href = '/';
    throw new Error('Your session has expired. Please log in again.');
  }

  return response;
}

// Read a response as JSON without throwing on empty/non-JSON bodies.
export async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { success: false, message: 'The server returned an unexpected response.' };
  }
}
