/**
 * API Client
 * Axios-based HTTP client with authentication and error handling
 * @module core/api/client
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import type { HttpErrorResponse } from '@/types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * API configuration
 */
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  withCredentials: boolean;
}

/**
 * Default API configuration
 */
const defaultConfig: ApiConfig = {
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 30000,
  withCredentials: true,
};

// ============================================================================
// Token Management
// ============================================================================

/**
 * Token getter function type
 */
type TokenGetter = () => string | null;

/**
 * Token refresh function type
 */
type TokenRefresher = () => Promise<boolean>;

/**
 * Token management callbacks
 */
interface TokenCallbacks {
  getAccessToken: TokenGetter;
  refreshToken: TokenRefresher;
  onAuthError: () => void;
}

let tokenCallbacks: TokenCallbacks | null = null;

/**
 * Set token management callbacks
 * Called by auth store during initialization
 */
export function setTokenCallbacks(callbacks: TokenCallbacks): void {
  tokenCallbacks = callbacks;
}

/**
 * Clear token callbacks
 * Called during logout
 */
export function clearTokenCallbacks(): void {
  tokenCallbacks = null;
}

// ============================================================================
// Request Queue for Token Refresh
// ============================================================================

interface QueuedRequest {
  resolve: (value: AxiosResponse) => void;
  reject: (reason: unknown) => void;
  config: InternalAxiosRequestConfig;
}

let isRefreshing = false;
let requestQueue: QueuedRequest[] = [];

/**
 * Process queued requests after token refresh
 */
function processQueue(error: Error | null): void {
  requestQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      // Retry with new token
      const token = tokenCallbacks?.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      apiClient(config).then(resolve).catch(reject);
    }
  });
  requestQueue = [];
}

// ============================================================================
// Axios Instance
// ============================================================================

/**
 * Create configured axios instance
 */
function createApiClient(config: ApiConfig = defaultConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    withCredentials: config.withCredentials,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = tokenCallbacks?.getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle errors and token refresh
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError<HttpErrorResponse>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Handle 401 Unauthorized
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Skip refresh for auth endpoints
        if (originalRequest.url?.includes('/auth/')) {
          return Promise.reject(error);
        }

        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            requestQueue.push({
              resolve,
              reject,
              config: originalRequest,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshed = await tokenCallbacks?.refreshToken();

          if (refreshed) {
            processQueue(null);

            // Retry original request with new token
            const token = tokenCallbacks?.getAccessToken();
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return instance(originalRequest);
          } else {
            // Refresh failed - clear auth state
            const authError = new Error('Token refresh failed');
            processQueue(authError);
            tokenCallbacks?.onAuthError();
            return Promise.reject(authError);
          }
        } catch (refreshError) {
          const authError = refreshError instanceof Error
            ? refreshError
            : new Error('Token refresh failed');
          processQueue(authError);
          tokenCallbacks?.onAuthError();
          return Promise.reject(authError);
        } finally {
          isRefreshing = false;
        }
      }

      // Transform error response
      return Promise.reject(transformError(error));
    }
  );

  return instance;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * API error class with additional context
 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isNetworkError = statusCode === 0;
    this.isTimeout = code === 'ECONNABORTED' || code === 'TIMEOUT';
  }
}

/**
 * Transform axios error to ApiClientError
 */
function transformError(error: AxiosError<HttpErrorResponse>): ApiClientError {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    return new ApiClientError(
      data.message || error.message,
      status,
      data.code || 'UNKNOWN_ERROR',
      data as unknown as Record<string, unknown>
    );
  }

  if (error.code === 'ECONNABORTED') {
    return new ApiClientError(
      'Request timeout',
      0,
      'TIMEOUT'
    );
  }

  // Network error
  return new ApiClientError(
    error.message || 'Network error',
    0,
    'NETWORK_ERROR'
  );
}

// ============================================================================
// API Client Instance
// ============================================================================

/**
 * Main API client instance
 */
export const apiClient = createApiClient();

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * GET request
 */
export async function get<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

/**
 * POST request
 */
export async function post<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

/**
 * PUT request
 */
export async function put<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.put<T>(url, data, config);
  return response.data;
}

/**
 * PATCH request
 */
export async function patch<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.patch<T>(url, data, config);
  return response.data;
}

/**
 * DELETE request
 */
export async function del<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build query string from params object
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Check if error is an ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
