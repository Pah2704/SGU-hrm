import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol || 'http:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:3001`;
  }

  return 'http://localhost:3001';
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

type ApiEnvelope<T> = {
  statusCode: number;
  message: string;
  data?: T;
  meta?: unknown;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const isBrowser = () => typeof window !== 'undefined';

const getAccessToken = () =>
  isBrowser() ? localStorage.getItem('accessToken') : null;

const setAccessToken = (token: string) => {
  if (isBrowser()) {
    localStorage.setItem('accessToken', token);
  }
};

const clearSession = () => {
  if (isBrowser()) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};

const TOKEN_REFRESH_SKEW_MS = 30 * 1000;
const AUTH_LOGIN_PATH = '/auth/login';
const AUTH_REFRESH_PATH = '/auth/refresh';

const parseTokenExpiryMs = (token: string | null): number | null => {
  if (!token) {
    return null;
  }

  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    return null;
  }

  try {
    const payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalizedPayload =
      payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(normalizedPayload)) as { exp?: number };
    if (typeof decoded.exp !== 'number') {
      return null;
    }

    return decoded.exp * 1000;
  } catch {
    return null;
  }
};

const isAccessTokenNearExpiry = (token: string | null): boolean => {
  const expiryMs = parseTokenExpiryMs(token);
  if (!expiryMs) {
    return false;
  }

  return expiryMs - Date.now() <= TOKEN_REFRESH_SKEW_MS;
};

const isAuthRequestUrl = (requestUrl: string): boolean =>
  requestUrl.includes(AUTH_LOGIN_PATH) || requestUrl.includes(AUTH_REFRESH_PATH);

const redirectToForbiddenIfNeeded = () => {
  if (!isBrowser()) {
    return;
  }

  const currentPath = window.location.pathname;
  const canRedirect =
    currentPath !== '/forbidden' &&
    currentPath !== '/login' &&
    !currentPath.startsWith('/public');

  if (canRedirect) {
    window.location.href = '/forbidden';
  }
};

let refreshPromise: Promise<string> | null = null;
let redirectingToLogin = false;

const requestNewAccessToken = async () => {
  const response = await api.post<{ accessToken: string; expiresIn: number }>(
    '/auth/refresh',
  );
  const nextToken = response.data.accessToken;
  setAccessToken(nextToken);
  return nextToken;
};

const redirectToLogin = () => {
  if (!isBrowser()) {
    return;
  }

  if (redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;
  window.location.href = '/login';
};

const unwrapApiEnvelope = <T>(payload: unknown): T => {
  if (!payload || typeof payload !== 'object') {
    return payload as T;
  }

  const normalizedPayload = payload as Record<string, unknown>;

  // Legacy backend envelope: { statusCode, message, data, meta? }
  if (
    'statusCode' in normalizedPayload &&
    'message' in normalizedPayload &&
    'data' in normalizedPayload
  ) {
    const envelope = normalizedPayload as ApiEnvelope<unknown>;

    if ('meta' in envelope) {
      return { data: envelope.data, meta: envelope.meta } as T;
    }

    return envelope.data as T;
  }

  // New backend envelope for paginated resources: { data, meta }
  if ('data' in normalizedPayload && 'meta' in normalizedPayload) {
    return {
      data: normalizedPayload.data,
      meta: normalizedPayload.meta,
    } as T;
  }

  // New backend envelope for single resources: { data }
  if ('data' in normalizedPayload) {
    return normalizedPayload.data as T;
  }

  // New backend envelope for action responses: { message }
  return payload as T;
};

// Request interceptor to add JWT
api.interceptors.request.use(
  async (config) => {
    if (!isBrowser()) {
      return config;
    }

    const requestUrl = config.url ?? '';
    const isAuthRequest = isAuthRequestUrl(requestUrl);

    let token = getAccessToken();

    if (!isAuthRequest && token && isAccessTokenNearExpiry(token)) {
      try {
        refreshPromise ??= requestNewAccessToken();
        token = await refreshPromise;
      } catch (error) {
        clearSession();
        redirectToLogin();
        return Promise.reject(error);
      } finally {
        refreshPromise = null;
      }
    }

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for 401 refresh-token flow.
api.interceptors.response.use(
  (response) => {
    response.data = unwrapApiEnvelope(response.data);
    return response;
  },
  async (error: AxiosError) => {
    if (!isBrowser()) {
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      redirectToForbiddenIfNeeded();
      return Promise.reject(error);
    }

    const requestConfig = error.config as RetryableRequestConfig | undefined;
    const requestUrl = requestConfig?.url ?? '';
    const isAuthRequest = isAuthRequestUrl(requestUrl);

    if (
      error.response?.status !== 401 ||
      !requestConfig ||
      requestConfig._retry ||
      isAuthRequest
    ) {
      return Promise.reject(error);
    }

    requestConfig._retry = true;

    try {
      refreshPromise ??= requestNewAccessToken();
      const nextToken = await refreshPromise;
      requestConfig.headers = requestConfig.headers ?? {};
      requestConfig.headers.Authorization = `Bearer ${nextToken}`;
      return api(requestConfig);
    } catch (refreshError) {
      clearSession();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);

export default api;
