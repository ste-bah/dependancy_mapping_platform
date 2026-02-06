---
id: authentication
title: API Authentication
sidebar_position: 1
description: How to authenticate with the DMP API
---

# API Authentication

The Dependency Mapping Platform API supports multiple authentication methods to accommodate different use cases.

## Authentication Methods

| Method | Use Case | Token Lifetime |
|--------|----------|----------------|
| **OAuth 2.0 (PKCE)** | Web applications, user context | 15 min access, 7 day refresh |
| **API Keys** | CI/CD, automation, scripts | Configurable (max 1 year) |
| **JWT Bearer** | Authenticated API requests | 15 minutes |

## OAuth 2.0 Authentication

For web applications and user-facing integrations, use OAuth 2.0 with PKCE.

### Authorization Flow

```
1. User clicks "Login with GitHub"
2. Redirect to: https://api.code-reviewer.io/auth/github
3. User authenticates with GitHub
4. Callback to: https://your-app.com/callback?code=xxx
5. Exchange code for tokens
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/github` | GET | Initiate GitHub OAuth |
| `/auth/gitlab` | GET | Initiate GitLab OAuth |
| `/auth/callback` | GET | OAuth callback handler |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/logout` | POST | Invalidate tokens |

### Token Exchange

After receiving the authorization code:

```bash
curl -X POST https://api.code-reviewer.io/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization_code",
    "redirect_uri": "https://your-app.com/callback"
  }'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

### Token Refresh

Access tokens expire after 15 minutes. Use the refresh token to obtain new tokens:

```bash
curl -X POST https://api.code-reviewer.io/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
  }'
```

## API Keys

For automation and CI/CD pipelines, API keys provide long-lived authentication.

### Creating an API Key

1. Navigate to **Settings > API Keys** in the web application
2. Click **"Create New Key"**
3. Enter a descriptive name (e.g., "GitHub Actions CI")
4. Select the required scopes
5. Set an expiration date (recommended: 90 days)
6. Click **"Create"**

**Important**: Copy the key immediately. It will only be shown once.

### API Key Format

API keys follow this format:

```
dmp_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Available Scopes

| Scope | Description |
|-------|-------------|
| `read:repositories` | List and view repositories |
| `write:repositories` | Add and modify repositories |
| `read:scans` | View scan results |
| `write:scans` | Trigger new scans |
| `read:graphs` | Access dependency graphs |
| `admin:keys` | Manage API keys |

### Using API Keys

Include the key in the `Authorization` header:

```bash
curl -X GET https://api.code-reviewer.io/api/v1/repositories \
  -H "Authorization: Bearer dmp_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Or use the `X-API-Key` header:

```bash
curl -X GET https://api.code-reviewer.io/api/v1/repositories \
  -H "X-API-Key: dmp_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Key Rotation

Rotate API keys regularly for security:

```bash
# Create a new key before revoking the old one
curl -X POST https://api.code-reviewer.io/api/v1/api-keys \
  -H "Authorization: Bearer $OLD_KEY" \
  -d '{
    "name": "GitHub Actions CI (rotated)",
    "scopes": ["read:repositories", "read:scans", "write:scans", "read:graphs"],
    "expiresAt": "2026-05-01T00:00:00Z"
  }'

# Update your CI/CD secrets with the new key
# Then revoke the old key
curl -X DELETE https://api.code-reviewer.io/api/v1/api-keys/{keyId} \
  -H "Authorization: Bearer $NEW_KEY"
```

## Using Bearer Tokens

All authenticated API requests require a Bearer token:

```bash
curl -X GET https://api.code-reviewer.io/api/v1/repositories \
  -H "Authorization: Bearer {access_token}"
```

### Token Claims

JWT tokens contain the following claims:

```json
{
  "sub": "user_123",
  "tenant_id": "tenant_456",
  "email": "user@example.com",
  "roles": ["user"],
  "scopes": ["read:repositories", "write:scans"],
  "iat": 1707148800,
  "exp": 1707149700,
  "iss": "https://api.code-reviewer.io",
  "aud": "dmp-api"
}
```

## Security Best Practices

### Token Storage

- **Web Apps**: Store tokens in secure, httpOnly cookies
- **SPAs**: Use in-memory storage, avoid localStorage
- **CI/CD**: Use encrypted secrets (GitHub Secrets, Vault)

### API Key Security

1. **Limit scopes**: Only request necessary permissions
2. **Set expiration**: Use short-lived keys when possible
3. **Rotate regularly**: Replace keys every 90 days
4. **Monitor usage**: Check API key activity logs
5. **Revoke immediately**: Remove unused or compromised keys

### Error Handling

Authentication errors return standardized responses:

```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": {
      "expiredAt": "2026-02-05T10:00:00Z"
    }
  }
}
```

| Error Code | Status | Description |
|------------|--------|-------------|
| `AUTH_MISSING_TOKEN` | 401 | No token provided |
| `AUTH_INVALID_TOKEN` | 401 | Token is malformed |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired |
| `AUTH_INSUFFICIENT_SCOPE` | 403 | Token lacks required scope |
| `AUTH_KEY_REVOKED` | 401 | API key was revoked |

## Rate Limiting

Authentication requests are rate limited:

| Endpoint | Limit |
|----------|-------|
| `/auth/*` | 10 requests/minute |
| API with key | 1000 requests/minute |
| API with OAuth | 100 requests/minute |

See [Rate Limits](/api/rate-limits) for details.

## Multi-Tenant Context

All requests are scoped to a tenant. The tenant is derived from:

1. JWT `tenant_id` claim (for OAuth tokens)
2. API key's associated tenant

Cross-tenant access is not permitted.

## Next Steps

- [API Endpoints](/api/endpoints) - Full API reference
- [API Keys Management](/api/api-keys) - Detailed key management
- [Error Handling](/api/error-handling) - Understanding API errors
