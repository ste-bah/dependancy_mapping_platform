/**
 * API Module Index
 * Re-exports API client and utilities
 * @module core/api
 */

export {
  apiClient,
  get,
  post,
  put,
  patch,
  del,
  setTokenCallbacks,
  clearTokenCallbacks,
  buildQueryString,
  isApiClientError,
  ApiClientError,
  type ApiConfig,
} from './client';
