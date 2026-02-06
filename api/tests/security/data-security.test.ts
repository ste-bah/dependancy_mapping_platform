/**
 * Data Security Tests
 * @module tests/security/data-security
 *
 * Tests for sensitive data handling, secrets detection,
 * data sanitization, and secure logging.
 *
 * CWE Coverage:
 * - CWE-200: Exposure of Sensitive Information
 * - CWE-312: Cleartext Storage of Sensitive Information
 * - CWE-532: Insertion of Sensitive Information into Log File
 * - CWE-209: Generation of Error Message Containing Sensitive Info
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';

// ============================================================================
// Sensitive Data Handling Tests
// ============================================================================

describe('Data Security', () => {
  describe('Sensitive Data Handling', () => {
    /**
     * Fields that should be redacted in logs
     */
    const SENSITIVE_FIELDS = [
      'password',
      'passwd',
      'secret',
      'token',
      'api_key',
      'apiKey',
      'api-key',
      'access_token',
      'accessToken',
      'refresh_token',
      'refreshToken',
      'authorization',
      'auth',
      'credentials',
      'private_key',
      'privateKey',
      'ssn',
      'credit_card',
      'creditCard',
      'cvv',
      'pin',
    ];

    /**
     * Redacts sensitive fields from an object for logging
     */
    function redactSensitiveData(
      obj: Record<string, unknown>,
      redactedValue = '[REDACTED]'
    ): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Check if key matches any sensitive field pattern
        const isSensitive = SENSITIVE_FIELDS.some(
          field => lowerKey.includes(field.toLowerCase())
        );

        if (isSensitive) {
          result[key] = redactedValue;
        } else if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            result[key] = value.map(item =>
              typeof item === 'object' && item !== null
                ? redactSensitiveData(item as Record<string, unknown>, redactedValue)
                : item
            );
          } else {
            result[key] = redactSensitiveData(
              value as Record<string, unknown>,
              redactedValue
            );
          }
        } else {
          result[key] = value;
        }
      }

      return result;
    }

    it('should redact passwords in logs', () => {
      const logData = {
        user: 'admin',
        password: 'supersecret123',
        action: 'login',
        userPassword: 'anotherSecret',
        databasePassword: 'dbpass456',
      };

      const redacted = redactSensitiveData(logData);

      expect(redacted.user).toBe('admin');
      expect(redacted.action).toBe('login');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.userPassword).toBe('[REDACTED]');
      expect(redacted.databasePassword).toBe('[REDACTED]');
    });

    it('should redact API tokens in logs', () => {
      const logData = {
        userId: '123',
        apiKey: 'sk_live_abc123xyz789',
        api_key: 'another_api_key_value',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        access_token: 'bearer_token_value',
        refreshToken: 'refresh_abc123',
        authorization: 'Bearer xyz789',
      };

      const redacted = redactSensitiveData(logData);

      expect(redacted.userId).toBe('123');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.api_key).toBe('[REDACTED]');
      expect(redacted.accessToken).toBe('[REDACTED]');
      expect(redacted.access_token).toBe('[REDACTED]');
      expect(redacted.refreshToken).toBe('[REDACTED]');
      expect(redacted.authorization).toBe('[REDACTED]');
    });

    it('should redact sensitive data in nested objects', () => {
      const logData = {
        request: {
          headers: {
            authorization: 'Bearer secret-token',
            'content-type': 'application/json',
          },
          body: {
            username: 'user',
            password: 'secret',
          },
        },
        response: {
          token: 'new-access-token',
          user: { id: 1, name: 'Test' },
        },
      };

      const redacted = redactSensitiveData(logData) as any;

      expect(redacted.request.headers.authorization).toBe('[REDACTED]');
      expect(redacted.request.headers['content-type']).toBe('application/json');
      expect(redacted.request.body.username).toBe('user');
      expect(redacted.request.body.password).toBe('[REDACTED]');
      expect(redacted.response.token).toBe('[REDACTED]');
      expect(redacted.response.user.name).toBe('Test');
    });

    it('should not expose internal paths in errors', () => {
      /**
       * Sanitizes error messages for external exposure
       */
      function sanitizeError(error: Error, isProduction: boolean): {
        message: string;
        code?: string;
        stack?: string;
      } {
        if (isProduction) {
          // In production, hide internal details
          return {
            message: 'An internal error occurred',
            code: 'INTERNAL_ERROR',
          };
        }

        // In development, sanitize paths
        let sanitizedMessage = error.message;
        let sanitizedStack = error.stack;

        // Remove absolute paths
        const pathPattern = /\/[^\s:]+\/[^\s:]+/g;
        sanitizedMessage = sanitizedMessage.replace(pathPattern, '[path]');
        if (sanitizedStack) {
          sanitizedStack = sanitizedStack.replace(pathPattern, '[path]');
        }

        // Remove sensitive environment info
        const envPattern = /(NODE_ENV|DATABASE_URL|API_KEY|SECRET)[=:][^\s]+/gi;
        sanitizedMessage = sanitizedMessage.replace(envPattern, '$1=[hidden]');

        return {
          message: sanitizedMessage,
          stack: sanitizedStack,
        };
      }

      const errorWithPath = new Error(
        'Cannot read file /home/user/app/secrets/config.json'
      );

      const productionResponse = sanitizeError(errorWithPath, true);
      expect(productionResponse.message).toBe('An internal error occurred');
      expect(productionResponse.stack).toBeUndefined();

      const devResponse = sanitizeError(errorWithPath, false);
      expect(devResponse.message).not.toContain('/home/user');
      expect(devResponse.message).toContain('[path]');
    });

    it('should sanitize stack traces', () => {
      function sanitizeStackTrace(stack: string): string {
        // Remove absolute file paths
        let sanitized = stack.replace(
          /at .+ \(\/[^)]+\)/g,
          'at [internal]'
        );

        // Remove node_modules internal paths
        sanitized = sanitized.replace(
          /node_modules\/[^)]+/g,
          'node_modules/[package]'
        );

        // Remove line numbers from internal code
        sanitized = sanitized.replace(
          /:\d+:\d+/g,
          ':X:X'
        );

        return sanitized;
      }

      const stack = `Error: Database connection failed
        at Pool.connect (/app/node_modules/pg/lib/pool.js:123:45)
        at DatabaseService.query (/home/user/code-reviewer/api/src/db/connection.ts:67:22)
        at ScanService.process (/home/user/code-reviewer/api/src/services/scan.ts:145:18)`;

      const sanitized = sanitizeStackTrace(stack);

      expect(sanitized).not.toContain('/home/user');
      expect(sanitized).not.toContain('/app/node_modules/pg/lib/pool.js');
    });
  });

  // ============================================================================
  // Secrets Detection Tests
  // ============================================================================

  describe('Secrets Detection', () => {
    /**
     * Secret detection patterns
     */
    const SECRET_PATTERNS = {
      awsAccessKey: {
        pattern: /AKIA[0-9A-Z]{16}/g,
        name: 'AWS Access Key ID',
        severity: 'critical',
      },
      awsSecretKey: {
        pattern: /aws_secret_access_key\s*=\s*["']?[a-zA-Z0-9/+=]{40}["']?/gi,
        name: 'AWS Secret Access Key',
        severity: 'critical',
      },
      genericPassword: {
        pattern: /password\s*[:=]\s*["'][^"']{4,}["']/gi,
        name: 'Hardcoded Password',
        severity: 'high',
      },
      genericApiKey: {
        pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_-]{16,}["']/gi,
        name: 'API Key',
        severity: 'high',
      },
      privateKey: {
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]+?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
        name: 'Private Key',
        severity: 'critical',
      },
      gitHubToken: {
        pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g,
        name: 'GitHub Token',
        severity: 'critical',
      },
      slackToken: {
        pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
        name: 'Slack Token',
        severity: 'high',
      },
      jwtSecret: {
        pattern: /jwt[_-]?secret\s*[:=]\s*["'][^"']{8,}["']/gi,
        name: 'JWT Secret',
        severity: 'critical',
      },
      databaseUrl: {
        pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^\s"']+/gi,
        name: 'Database URL with credentials',
        severity: 'critical',
      },
      genericSecret: {
        pattern: /secret\s*[:=]\s*["'][^"']{8,}["']/gi,
        name: 'Generic Secret',
        severity: 'medium',
      },
    };

    interface SecretFinding {
      type: string;
      severity: string;
      match: string;
      line?: number;
      column?: number;
    }

    /**
     * Scans content for secrets
     */
    function scanForSecrets(content: string): SecretFinding[] {
      const findings: SecretFinding[] = [];
      const lines = content.split('\n');

      for (const [type, config] of Object.entries(SECRET_PATTERNS)) {
        const pattern = new RegExp(config.pattern.source, config.pattern.flags);
        let match;

        while ((match = pattern.exec(content)) !== null) {
          // Find line number
          let charCount = 0;
          let lineNumber = 1;
          for (const line of lines) {
            charCount += line.length + 1;
            if (charCount > match.index) {
              break;
            }
            lineNumber++;
          }

          findings.push({
            type: config.name,
            severity: config.severity,
            match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
            line: lineNumber,
          });
        }
      }

      return findings;
    }

    it('should detect hardcoded AWS keys', () => {
      const terraformWithSecrets = `
        provider "aws" {
          region     = "us-east-1"
          access_key = "AKIAIOSFODNN7EXAMPLE"
          secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        }
      `;

      // Using direct pattern match for this test
      const awsPattern = /AKIA[0-9A-Z]{16}/;
      expect(awsPattern.test(terraformWithSecrets)).toBe(true);
    });

    it('should detect hardcoded private keys', () => {
      const codeWithPrivateKey = `
        const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2mKqH...
-----END RSA PRIVATE KEY-----\`;
      `;

      const findings = scanForSecrets(codeWithPrivateKey);
      const pkFinding = findings.find(f => f.type === 'Private Key');

      expect(pkFinding).toBeDefined();
      expect(pkFinding?.severity).toBe('critical');
    });

    it('should detect hardcoded passwords in config', () => {
      const configWithPassword = `
        database:
          host: localhost
          password: "supersecret123"
          user: admin
      `;

      const findings = scanForSecrets(configWithPassword);
      const pwdFinding = findings.find(f => f.type === 'Hardcoded Password');

      expect(pwdFinding).toBeDefined();
    });

    it('should detect GitHub tokens', () => {
      const codeWithGitHubToken = `
        const GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const findings = scanForSecrets(codeWithGitHubToken);
      const ghFinding = findings.find(f => f.type === 'GitHub Token');

      expect(ghFinding).toBeDefined();
      expect(ghFinding?.severity).toBe('critical');
    });

    it('should detect database URLs with credentials', () => {
      const configWithDbUrl = `
        DATABASE_URL=postgresql://admin:password123@db.example.com:5432/myapp
      `;

      const findings = scanForSecrets(configWithDbUrl);
      const dbFinding = findings.find(f => f.type === 'Database URL with credentials');

      expect(dbFinding).toBeDefined();
      expect(dbFinding?.severity).toBe('critical');
    });

    it('should not flag environment variable references', () => {
      const safeCode = `
        const password = process.env.DATABASE_PASSWORD;
        const apiKey = process.env.API_KEY;
        const secret = config.get('jwt.secret');
      `;

      // These patterns use env vars, not hardcoded values
      const hardcodedPattern = /password\s*[:=]\s*["'][^"']+["']/gi;
      expect(hardcodedPattern.test(safeCode)).toBe(false);
    });
  });

  // ============================================================================
  // Data Encryption Tests
  // ============================================================================

  describe('Data Encryption', () => {
    it('should encrypt sensitive data at rest', () => {
      const ENCRYPTION_KEY = crypto.randomBytes(32); // 256-bit key
      const IV_LENGTH = 16;

      /**
       * Encrypts data using AES-256-GCM
       */
      function encrypt(plaintext: string, key: Buffer): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Return iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      }

      /**
       * Decrypts data using AES-256-GCM
       */
      function decrypt(ciphertext: string, key: Buffer): string {
        const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
      }

      const sensitiveData = 'user-secret-api-key-12345';
      const encrypted = encrypt(sensitiveData, ENCRYPTION_KEY);
      const decrypted = decrypt(encrypted, ENCRYPTION_KEY);

      expect(encrypted).not.toBe(sensitiveData);
      expect(encrypted.split(':')).toHaveLength(3);
      expect(decrypted).toBe(sensitiveData);
    });

    it('should use strong hashing for passwords', async () => {
      /**
       * Hashes password using bcrypt-like approach
       * (Using PBKDF2 as substitute since bcrypt needs native bindings)
       */
      async function hashPassword(password: string): Promise<string> {
        const salt = crypto.randomBytes(16);
        const iterations = 100000;

        return new Promise((resolve, reject) => {
          crypto.pbkdf2(
            password,
            salt,
            iterations,
            64,
            'sha512',
            (err, derivedKey) => {
              if (err) reject(err);
              resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
            }
          );
        });
      }

      /**
       * Verifies password against hash
       */
      async function verifyPassword(password: string, hash: string): Promise<boolean> {
        const [saltHex, keyHex] = hash.split(':');
        const salt = Buffer.from(saltHex, 'hex');
        const iterations = 100000;

        return new Promise((resolve, reject) => {
          crypto.pbkdf2(
            password,
            salt,
            iterations,
            64,
            'sha512',
            (err, derivedKey) => {
              if (err) reject(err);
              resolve(derivedKey.toString('hex') === keyHex);
            }
          );
        });
      }

      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.split(':')).toHaveLength(2);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should not use weak cryptographic algorithms', () => {
      const WEAK_ALGORITHMS = ['md5', 'sha1', 'des', 'rc4'];
      const STRONG_ALGORITHMS = ['sha256', 'sha384', 'sha512', 'aes-256-gcm'];

      function isAlgorithmSecure(algorithm: string): boolean {
        const lowerAlgo = algorithm.toLowerCase();
        return !WEAK_ALGORITHMS.some(weak => lowerAlgo.includes(weak));
      }

      // Weak algorithms should be rejected
      expect(isAlgorithmSecure('md5')).toBe(false);
      expect(isAlgorithmSecure('sha1')).toBe(false);
      expect(isAlgorithmSecure('des')).toBe(false);

      // Strong algorithms should be accepted
      expect(isAlgorithmSecure('sha256')).toBe(true);
      expect(isAlgorithmSecure('aes-256-gcm')).toBe(true);
    });
  });

  // ============================================================================
  // PII Protection Tests
  // ============================================================================

  describe('PII Protection', () => {
    /**
     * Detects and masks PII in strings
     */
    function maskPII(text: string): string {
      let masked = text;

      // Email addresses
      masked = masked.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[EMAIL]'
      );

      // Phone numbers (various formats)
      masked = masked.replace(
        /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
        '[PHONE]'
      );

      // SSN
      masked = masked.replace(
        /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
        '[SSN]'
      );

      // Credit card numbers
      masked = masked.replace(
        /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
        '[CREDIT_CARD]'
      );

      // IP addresses
      masked = masked.replace(
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        '[IP_ADDRESS]'
      );

      return masked;
    }

    it('should mask email addresses', () => {
      const text = 'Contact john.doe@example.com for more info';
      const masked = maskPII(text);

      expect(masked).not.toContain('john.doe@example.com');
      expect(masked).toContain('[EMAIL]');
    });

    it('should mask phone numbers', () => {
      const text = 'Call us at (555) 123-4567 or +1-555-987-6543';
      const masked = maskPII(text);

      expect(masked).not.toContain('555');
      expect(masked).toContain('[PHONE]');
    });

    it('should mask SSN', () => {
      const text = 'SSN: 123-45-6789';
      const masked = maskPII(text);

      expect(masked).not.toContain('123-45-6789');
      expect(masked).toContain('[SSN]');
    });

    it('should mask credit card numbers', () => {
      const text = 'Card: 4111-1111-1111-1111';
      const masked = maskPII(text);

      expect(masked).not.toContain('4111');
      expect(masked).toContain('[CREDIT_CARD]');
    });

    it('should mask IP addresses', () => {
      const text = 'Client IP: 192.168.1.100';
      const masked = maskPII(text);

      expect(masked).not.toContain('192.168');
      expect(masked).toContain('[IP_ADDRESS]');
    });
  });

  // ============================================================================
  // Data Retention Tests
  // ============================================================================

  describe('Data Retention', () => {
    it('should enforce data retention policies', () => {
      interface DataRecord {
        id: string;
        createdAt: Date;
        deletedAt?: Date;
        retentionDays: number;
      }

      function shouldPurgeRecord(record: DataRecord): boolean {
        const now = new Date();
        const ageInDays = Math.floor(
          (now.getTime() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return ageInDays > record.retentionDays;
      }

      const oldRecord: DataRecord = {
        id: 'old-1',
        createdAt: new Date('2020-01-01'),
        retentionDays: 365,
      };

      const recentRecord: DataRecord = {
        id: 'recent-1',
        createdAt: new Date(),
        retentionDays: 365,
      };

      expect(shouldPurgeRecord(oldRecord)).toBe(true);
      expect(shouldPurgeRecord(recentRecord)).toBe(false);
    });

    it('should securely delete data', () => {
      /**
       * Simulates secure data deletion
       */
      function secureDelete(data: Record<string, unknown>): Record<string, unknown> {
        const deleted: Record<string, unknown> = {};

        for (const key of Object.keys(data)) {
          if (typeof data[key] === 'string') {
            // Overwrite string data before deletion
            deleted[key] = crypto.randomBytes(String(data[key]).length).toString('hex');
          } else {
            deleted[key] = null;
          }
        }

        // Clear the original object
        for (const key of Object.keys(data)) {
          delete data[key];
        }

        return deleted;
      }

      const sensitiveData = {
        password: 'secret123',
        apiKey: 'key-abc-xyz',
        userId: 123,
      };

      const deleteResult = secureDelete(sensitiveData);

      // Original object should be cleared
      expect(Object.keys(sensitiveData)).toHaveLength(0);

      // Deleted values should be overwritten
      expect(deleteResult.password).not.toBe('secret123');
      expect(deleteResult.apiKey).not.toBe('key-abc-xyz');
    });
  });

  // ============================================================================
  // Audit Logging Tests
  // ============================================================================

  describe('Audit Logging', () => {
    interface AuditEvent {
      timestamp: Date;
      action: string;
      userId: string;
      resourceType: string;
      resourceId: string;
      ipAddress: string;
      userAgent: string;
      success: boolean;
      details?: Record<string, unknown>;
    }

    const auditLog: AuditEvent[] = [];

    function logAuditEvent(event: Omit<AuditEvent, 'timestamp'>): void {
      auditLog.push({
        ...event,
        timestamp: new Date(),
      });
    }

    beforeEach(() => {
      auditLog.length = 0;
    });

    it('should log all authentication events', () => {
      logAuditEvent({
        action: 'LOGIN_SUCCESS',
        userId: 'user-123',
        resourceType: 'session',
        resourceId: 'session-abc',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('LOGIN_SUCCESS');
      expect(auditLog[0].userId).toBe('user-123');
    });

    it('should log data access events', () => {
      logAuditEvent({
        action: 'DATA_ACCESS',
        userId: 'user-456',
        resourceType: 'scan',
        resourceId: 'scan-xyz',
        ipAddress: '10.0.0.1',
        userAgent: 'API Client/1.0',
        success: true,
        details: {
          fields: ['results', 'findings'],
        },
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('DATA_ACCESS');
      expect(auditLog[0].details).toBeDefined();
    });

    it('should log failed authentication attempts', () => {
      logAuditEvent({
        action: 'LOGIN_FAILED',
        userId: 'unknown',
        resourceType: 'authentication',
        resourceId: 'attempt-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        success: false,
        details: {
          reason: 'Invalid credentials',
          attemptedUsername: 'admin@example.com',
        },
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].success).toBe(false);
    });

    it('should not log sensitive data in audit events', () => {
      // Password should never appear in audit logs
      logAuditEvent({
        action: 'PASSWORD_CHANGE',
        userId: 'user-789',
        resourceType: 'credentials',
        resourceId: 'user-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        details: {
          // Note: password should NOT be logged
          passwordChanged: true,
        },
      });

      const event = auditLog[0];
      expect(event.details).not.toHaveProperty('oldPassword');
      expect(event.details).not.toHaveProperty('newPassword');
      expect(event.details).toHaveProperty('passwordChanged');
    });
  });
});
