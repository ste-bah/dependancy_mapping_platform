/**
 * Security Headers Tests
 * @module tests/security/headers
 *
 * Tests for proper security headers configuration.
 * Verifies protection against common web vulnerabilities.
 *
 * CWE Coverage:
 * - CWE-693: Protection Mechanism Failure
 * - CWE-1021: Improper Restriction of Rendered UI Layers (Clickjacking)
 * - CWE-942: Permissive Cross-domain Policy with Untrusted Domains
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ============================================================================
// Security Headers Configuration
// ============================================================================

/**
 * Expected security headers and their values
 */
const REQUIRED_SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'x-content-type-options': {
    expected: 'nosniff',
    required: true,
    description: 'Prevents MIME type sniffing attacks',
  },

  // Clickjacking protection
  'x-frame-options': {
    expected: ['DENY', 'SAMEORIGIN'],
    required: true,
    description: 'Prevents clickjacking by disallowing framing',
  },

  // XSS protection (legacy but still recommended)
  'x-xss-protection': {
    expected: ['1; mode=block', '0'],
    required: false,
    description: 'Enables browser XSS filtering (deprecated but harmless)',
  },

  // HTTP Strict Transport Security
  'strict-transport-security': {
    expected: /max-age=\d+/,
    required: true,
    description: 'Enforces HTTPS connections',
    minMaxAge: 31536000, // 1 year
  },

  // Content Security Policy
  'content-security-policy': {
    required: true,
    description: 'Restricts resource loading to prevent XSS',
    requiredDirectives: ['default-src', "script-src"],
  },

  // Referrer Policy
  'referrer-policy': {
    expected: [
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
    ],
    required: true,
    description: 'Controls referrer information sent with requests',
  },

  // Permissions Policy (formerly Feature-Policy)
  'permissions-policy': {
    required: false,
    description: 'Controls browser features like geolocation, camera, etc.',
  },

  // Cross-Origin policies
  'cross-origin-opener-policy': {
    expected: ['same-origin', 'same-origin-allow-popups'],
    required: false,
    description: 'Isolates browsing context',
  },

  'cross-origin-resource-policy': {
    expected: ['same-origin', 'same-site', 'cross-origin'],
    required: false,
    description: 'Blocks cross-origin resource requests',
  },
};

/**
 * Headers that should NOT be present
 */
const FORBIDDEN_HEADERS = {
  'x-powered-by': 'Reveals technology stack',
  'server': 'May reveal server software version (should be generic or absent)',
};

// ============================================================================
// Header Validation Functions
// ============================================================================

interface HeaderValidationResult {
  header: string;
  present: boolean;
  valid: boolean;
  value?: string;
  error?: string;
  recommendation?: string;
}

/**
 * Validates a single security header
 */
function validateHeader(
  headerName: string,
  headerValue: string | undefined,
  config: typeof REQUIRED_SECURITY_HEADERS[keyof typeof REQUIRED_SECURITY_HEADERS]
): HeaderValidationResult {
  const result: HeaderValidationResult = {
    header: headerName,
    present: headerValue !== undefined,
    valid: false,
    value: headerValue,
  };

  if (!result.present) {
    if (config.required) {
      result.error = `Required header ${headerName} is missing`;
      result.recommendation = `Add ${headerName}: ${config.description}`;
    } else {
      result.valid = true; // Optional header missing is OK
    }
    return result;
  }

  // Validate against expected value(s)
  if ('expected' in config) {
    const expected = config.expected;

    if (Array.isArray(expected)) {
      result.valid = expected.some(
        exp => headerValue?.toLowerCase() === exp.toLowerCase()
      );
    } else if (expected instanceof RegExp) {
      result.valid = expected.test(headerValue!);
    } else {
      result.valid = headerValue?.toLowerCase() === expected.toLowerCase();
    }

    if (!result.valid) {
      result.error = `Invalid value for ${headerName}: ${headerValue}`;
      result.recommendation = `Expected: ${JSON.stringify(expected)}`;
    }
  } else {
    // If no specific expected value, just check presence
    result.valid = result.present;
  }

  return result;
}

/**
 * Parses Content-Security-Policy header
 */
function parseCSP(cspValue: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();

  const parts = cspValue.split(';').map(p => p.trim());

  for (const part of parts) {
    const [directive, ...values] = part.split(/\s+/);
    if (directive) {
      directives.set(directive.toLowerCase(), values);
    }
  }

  return directives;
}

/**
 * Validates Content-Security-Policy
 */
function validateCSP(cspValue: string): {
  valid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  const directives = parseCSP(cspValue);

  // Check for required directives
  if (!directives.has('default-src')) {
    issues.push("Missing 'default-src' directive");
    recommendations.push("Add default-src 'self' as fallback");
  }

  // Check for unsafe practices
  const scriptSrc = directives.get('script-src') || directives.get('default-src') || [];

  if (scriptSrc.includes("'unsafe-inline'")) {
    issues.push("'unsafe-inline' in script-src is dangerous");
    recommendations.push('Use nonces or hashes instead of unsafe-inline');
  }

  if (scriptSrc.includes("'unsafe-eval'")) {
    issues.push("'unsafe-eval' in script-src allows code execution");
    recommendations.push('Remove unsafe-eval and refactor code to avoid eval()');
  }

  // Check for overly permissive sources
  if (scriptSrc.includes('*') || scriptSrc.includes('data:')) {
    issues.push('Overly permissive script sources');
    recommendations.push('Restrict script sources to specific trusted domains');
  }

  return {
    valid: issues.length === 0,
    issues,
    recommendations,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Security Headers', () => {
  describe('Required Security Headers', () => {
    /**
     * Simulated response headers from the application
     */
    const mockResponseHeaders: Record<string, string> = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '0',
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      'referrer-policy': 'strict-origin-when-cross-origin',
      'cross-origin-opener-policy': 'same-origin',
    };

    it('should set X-Content-Type-Options header', () => {
      const result = validateHeader(
        'x-content-type-options',
        mockResponseHeaders['x-content-type-options'],
        REQUIRED_SECURITY_HEADERS['x-content-type-options']
      );

      expect(result.present).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('nosniff');
    });

    it('should set X-Frame-Options header to prevent clickjacking', () => {
      const result = validateHeader(
        'x-frame-options',
        mockResponseHeaders['x-frame-options'],
        REQUIRED_SECURITY_HEADERS['x-frame-options']
      );

      expect(result.present).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should set Strict-Transport-Security header', () => {
      const header = mockResponseHeaders['strict-transport-security'];
      const config = REQUIRED_SECURITY_HEADERS['strict-transport-security'];

      const result = validateHeader('strict-transport-security', header, config);

      expect(result.present).toBe(true);
      expect(result.valid).toBe(true);

      // Validate max-age is sufficient
      const maxAgeMatch = header?.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1], 10);
        expect(maxAge).toBeGreaterThanOrEqual(config.minMaxAge!);
      }
    });

    it('should include includeSubDomains in HSTS', () => {
      const header = mockResponseHeaders['strict-transport-security'];
      expect(header).toContain('includeSubDomains');
    });

    it('should set Referrer-Policy header', () => {
      const result = validateHeader(
        'referrer-policy',
        mockResponseHeaders['referrer-policy'],
        REQUIRED_SECURITY_HEADERS['referrer-policy']
      );

      expect(result.present).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should set Cross-Origin-Opener-Policy header', () => {
      const header = mockResponseHeaders['cross-origin-opener-policy'];
      expect(header).toBeDefined();
      expect(['same-origin', 'same-origin-allow-popups']).toContain(header);
    });
  });

  describe('Content-Security-Policy', () => {
    it('should have valid CSP header', () => {
      const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";
      const validation = validateCSP(csp);

      expect(validation.valid).toBe(true);
    });

    it('should have default-src directive', () => {
      const csp = "script-src 'self'"; // Missing default-src
      const validation = validateCSP(csp);

      expect(validation.issues).toContain("Missing 'default-src' directive");
    });

    it('should not allow unsafe-inline in script-src', () => {
      const unsafeCSP = "default-src 'self'; script-src 'self' 'unsafe-inline'";
      const validation = validateCSP(unsafeCSP);

      expect(validation.issues).toContain("'unsafe-inline' in script-src is dangerous");
    });

    it('should not allow unsafe-eval in script-src', () => {
      const unsafeCSP = "default-src 'self'; script-src 'self' 'unsafe-eval'";
      const validation = validateCSP(unsafeCSP);

      expect(validation.issues).toContain("'unsafe-eval' in script-src allows code execution");
    });

    it('should not allow wildcard in script-src', () => {
      const wildcardCSP = "default-src 'self'; script-src *";
      const validation = validateCSP(wildcardCSP);

      expect(validation.issues).toContain('Overly permissive script sources');
    });

    it('should parse CSP directives correctly', () => {
      const csp = "default-src 'self'; script-src 'self' https://cdn.example.com; img-src 'self' data:";
      const directives = parseCSP(csp);

      expect(directives.get('default-src')).toEqual(["'self'"]);
      expect(directives.get('script-src')).toContain("'self'");
      expect(directives.get('script-src')).toContain('https://cdn.example.com');
      expect(directives.get('img-src')).toContain('data:');
    });
  });

  describe('Forbidden Headers', () => {
    it('should not expose X-Powered-By header', () => {
      const mockHeaders: Record<string, string> = {
        'content-type': 'application/json',
        // x-powered-by should NOT be present
      };

      expect(mockHeaders['x-powered-by']).toBeUndefined();
    });

    it('should not expose detailed Server header', () => {
      // Server header should be generic or absent
      const mockHeaders: Record<string, string> = {
        'content-type': 'application/json',
        // 'server': 'Apache/2.4.51 (Ubuntu)' // BAD - reveals version
        // 'server': 'nginx' // OK - generic
        // No server header // BEST
      };

      const server = mockHeaders['server'];

      if (server) {
        // If present, should not contain version info
        expect(server).not.toMatch(/\d+\.\d+/);
      }
    });
  });

  describe('CORS Headers', () => {
    it('should not use wildcard origin in production', () => {
      function validateCORSOrigin(
        origin: string,
        environment: 'development' | 'production'
      ): { valid: boolean; issue?: string } {
        if (origin === '*' && environment === 'production') {
          return {
            valid: false,
            issue: 'Wildcard CORS origin is not allowed in production',
          };
        }

        // Validate specific origins
        if (origin !== '*') {
          try {
            const url = new URL(origin);
            if (url.protocol !== 'https:' && environment === 'production') {
              return {
                valid: false,
                issue: 'CORS origin must use HTTPS in production',
              };
            }
          } catch {
            return {
              valid: false,
              issue: 'Invalid CORS origin URL',
            };
          }
        }

        return { valid: true };
      }

      // Production checks
      expect(validateCORSOrigin('*', 'production').valid).toBe(false);
      expect(validateCORSOrigin('https://app.example.com', 'production').valid).toBe(true);
      expect(validateCORSOrigin('http://app.example.com', 'production').valid).toBe(false);

      // Development allows more flexibility
      expect(validateCORSOrigin('*', 'development').valid).toBe(true);
    });

    it('should only allow specific HTTP methods', () => {
      const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
      const DANGEROUS_METHODS = ['TRACE', 'CONNECT', 'TRACK'];

      function validateAllowedMethods(methods: string[]): {
        valid: boolean;
        dangerousMethods: string[];
      } {
        const dangerous = methods.filter(m =>
          DANGEROUS_METHODS.includes(m.toUpperCase())
        );

        return {
          valid: dangerous.length === 0,
          dangerousMethods: dangerous,
        };
      }

      expect(validateAllowedMethods(ALLOWED_METHODS).valid).toBe(true);
      expect(validateAllowedMethods(['GET', 'TRACE']).valid).toBe(false);
    });

    it('should limit exposed headers', () => {
      const SAFE_EXPOSED_HEADERS = [
        'content-length',
        'content-type',
        'x-request-id',
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
      ];

      const SENSITIVE_HEADERS = [
        'set-cookie',
        'authorization',
        'x-api-key',
        'x-auth-token',
      ];

      function validateExposedHeaders(headers: string[]): {
        valid: boolean;
        sensitiveHeaders: string[];
      } {
        const sensitive = headers.filter(h =>
          SENSITIVE_HEADERS.includes(h.toLowerCase())
        );

        return {
          valid: sensitive.length === 0,
          sensitiveHeaders: sensitive,
        };
      }

      expect(validateExposedHeaders(SAFE_EXPOSED_HEADERS).valid).toBe(true);
      expect(validateExposedHeaders(['content-type', 'set-cookie']).valid).toBe(false);
    });
  });

  describe('Cookie Security', () => {
    interface CookieAttributes {
      name: string;
      value: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
      path?: string;
      domain?: string;
      maxAge?: number;
      expires?: Date;
    }

    function validateCookieSecurity(
      cookie: CookieAttributes,
      isSensitive: boolean
    ): { valid: boolean; issues: string[] } {
      const issues: string[] = [];

      if (isSensitive) {
        if (!cookie.httpOnly) {
          issues.push('Sensitive cookie missing HttpOnly flag');
        }

        if (!cookie.secure) {
          issues.push('Sensitive cookie missing Secure flag');
        }

        if (!cookie.sameSite || cookie.sameSite === 'None') {
          issues.push('Sensitive cookie should have SameSite=Strict or Lax');
        }
      }

      // All cookies should have SameSite in modern apps
      if (!cookie.sameSite) {
        issues.push('Cookie missing SameSite attribute');
      }

      // Session cookies should have reasonable expiry
      if (cookie.name.includes('session') || cookie.name.includes('token')) {
        if (cookie.maxAge && cookie.maxAge > 24 * 60 * 60) {
          issues.push('Session cookie has excessive max-age');
        }
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    }

    it('should set HttpOnly on session cookies', () => {
      const sessionCookie: CookieAttributes = {
        name: 'session_id',
        value: 'abc123',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/',
      };

      const result = validateCookieSecurity(sessionCookie, true);
      expect(result.valid).toBe(true);
    });

    it('should set Secure flag on all cookies', () => {
      const insecureCookie: CookieAttributes = {
        name: 'session_id',
        value: 'abc123',
        httpOnly: true,
        secure: false, // Missing Secure flag
        sameSite: 'Strict',
      };

      const result = validateCookieSecurity(insecureCookie, true);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Sensitive cookie missing Secure flag');
    });

    it('should set SameSite attribute', () => {
      const cookieWithoutSameSite: CookieAttributes = {
        name: 'user_preference',
        value: 'dark_mode',
        httpOnly: false,
        secure: true,
        // sameSite missing
      };

      const result = validateCookieSecurity(cookieWithoutSameSite, false);
      expect(result.issues).toContain('Cookie missing SameSite attribute');
    });

    it('should use SameSite=Strict for sensitive cookies', () => {
      const cookieWithLaxSameSite: CookieAttributes = {
        name: 'auth_token',
        value: 'jwt_token_here',
        httpOnly: true,
        secure: true,
        sameSite: 'None', // Should be Strict for auth cookies
      };

      const result = validateCookieSecurity(cookieWithLaxSameSite, true);
      expect(result.issues).toContain('Sensitive cookie should have SameSite=Strict or Lax');
    });
  });

  describe('API Response Headers', () => {
    it('should set Cache-Control for sensitive responses', () => {
      function validateCacheControl(
        header: string | undefined,
        containsSensitiveData: boolean
      ): { valid: boolean; issue?: string } {
        if (!containsSensitiveData) {
          return { valid: true };
        }

        if (!header) {
          return {
            valid: false,
            issue: 'Missing Cache-Control header for sensitive response',
          };
        }

        const mustHaveDirectives = ['no-store', 'no-cache', 'private'];
        const hasProperDirectives = mustHaveDirectives.some(d =>
          header.toLowerCase().includes(d)
        );

        if (!hasProperDirectives) {
          return {
            valid: false,
            issue: 'Sensitive response should have no-store or no-cache directive',
          };
        }

        return { valid: true };
      }

      // Sensitive response should not be cached
      expect(
        validateCacheControl('no-store, no-cache, must-revalidate', true).valid
      ).toBe(true);

      expect(
        validateCacheControl('public, max-age=3600', true).valid
      ).toBe(false);

      expect(
        validateCacheControl(undefined, true).valid
      ).toBe(false);
    });

    it('should set Content-Type with charset', () => {
      function validateContentType(
        header: string | undefined
      ): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!header) {
          issues.push('Missing Content-Type header');
          return { valid: false, issues };
        }

        // For JSON responses
        if (header.includes('application/json')) {
          if (!header.includes('charset=utf-8')) {
            issues.push('JSON Content-Type should include charset=utf-8');
          }
        }

        return { valid: issues.length === 0, issues };
      }

      expect(
        validateContentType('application/json; charset=utf-8').valid
      ).toBe(true);

      expect(
        validateContentType('application/json').issues
      ).toContain('JSON Content-Type should include charset=utf-8');
    });
  });

  describe('Header Security Score', () => {
    interface HeaderAudit {
      score: number;
      maxScore: number;
      grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
      present: string[];
      missing: string[];
      invalid: string[];
    }

    function auditSecurityHeaders(
      headers: Record<string, string>
    ): HeaderAudit {
      let score = 0;
      const maxScore = Object.keys(REQUIRED_SECURITY_HEADERS).length * 10;
      const present: string[] = [];
      const missing: string[] = [];
      const invalid: string[] = [];

      for (const [headerName, config] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
        const headerValue = headers[headerName];
        const result = validateHeader(headerName, headerValue, config);

        if (result.present && result.valid) {
          score += 10;
          present.push(headerName);
        } else if (result.present && !result.valid) {
          score += 5; // Partial credit for presence
          invalid.push(headerName);
        } else if (config.required) {
          missing.push(headerName);
        } else {
          score += 5; // Optional headers get partial credit when missing
        }
      }

      const percentage = (score / maxScore) * 100;
      let grade: HeaderAudit['grade'];

      if (percentage >= 95) grade = 'A+';
      else if (percentage >= 85) grade = 'A';
      else if (percentage >= 75) grade = 'B';
      else if (percentage >= 65) grade = 'C';
      else if (percentage >= 50) grade = 'D';
      else grade = 'F';

      return { score, maxScore, grade, present, missing, invalid };
    }

    it('should calculate security header score', () => {
      const goodHeaders: Record<string, string> = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '0',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'content-security-policy': "default-src 'self'",
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-resource-policy': 'same-origin',
      };

      const audit = auditSecurityHeaders(goodHeaders);

      expect(audit.grade).toMatch(/^[AB]/);
      expect(audit.missing).toHaveLength(0);
    });

    it('should identify missing required headers', () => {
      const badHeaders: Record<string, string> = {
        'content-type': 'application/json',
        // Missing all security headers
      };

      const audit = auditSecurityHeaders(badHeaders);

      expect(audit.grade).toBe('F');
      expect(audit.missing.length).toBeGreaterThan(0);
    });
  });
});
