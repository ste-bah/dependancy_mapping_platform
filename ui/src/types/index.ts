/**
 * Type Definitions Index
 * Re-exports all type definitions
 * @module types
 */

// API Types
export type {
  PaginationParams,
  PaginationInfo,
  PaginatedResponse,
  ApiError,
  HttpErrorResponse,
  ApiSuccessResponse,
  ApiFailureResponse,
  ApiResponse,
  SortOrder,
  ListQueryParams,
  ErrorCode,
} from './api';

export {
  ErrorCodes,
  isApiError,
  isApiFailure,
  isApiSuccess,
  createPaginationInfo,
  getDefaultPaginationParams,
} from './api';

// Auth Types
export type {
  User,
  UserInfo,
  AuthTokens,
  TokenPayload,
  Session,
  AuthState,
  LoginResponse,
  RefreshTokenRequest,
  LogoutResponse,
  AuthContextValue,
  OAuthProvider,
  AuthErrorType,
  AuthError,
} from './auth';

export {
  isUser,
  hasAuthTokens,
  isTokenExpired,
  calculateExpiresAt,
} from './auth';
