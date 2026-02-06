# Threat Model - Dependency Mapping Platform

**Document Version:** 1.0.0
**Last Updated:** 2026-02-05
**Classification:** Internal - Security Sensitive
**NFR Reference:** NFR-SEC-009

---

## Executive Summary

This threat model documents the security analysis of the Dependency Mapping Platform (Code Reviewer), an enterprise-grade infrastructure-as-code analysis system. The platform processes sensitive repository data, manages multi-tenant isolation, and integrates with external Git providers.

---

## 1. Assets

### 1.1 Critical Assets (Tier 1)

| Asset | Description | Impact if Compromised |
|-------|-------------|----------------------|
| User Credentials | OAuth tokens (GitHub/GitLab), JWT access/refresh tokens | Full account takeover, unauthorized repository access |
| Repository Access Tokens | GitHub PATs, GitLab tokens, API keys | Code exfiltration, malicious commit injection |
| Tenant Data | Dependency graphs, scan results, configurations | Competitive intelligence leak, compliance violation |
| Platform Infrastructure | Databases, APIs, job queues | Complete service compromise |

### 1.2 High-Value Assets (Tier 2)

| Asset | Description | Impact if Compromised |
|-------|-------------|----------------------|
| Audit Logs | Security events, access records | Cover tracks, compliance failure |
| Encryption Keys | Data-at-rest keys, JWT signing keys | Mass decryption, token forgery |
| API Keys (Hashed) | Customer-issued API keys | Unauthorized API access |
| Configuration Secrets | Database URLs, Redis credentials | Lateral movement |

### 1.3 Standard Assets (Tier 3)

| Asset | Description | Impact if Compromised |
|-------|-------------|----------------------|
| Cached Data | Graph query caches, temporary files | Information disclosure |
| Session Data | Active user sessions | Session hijacking |
| Metrics Data | Performance and usage statistics | Reconnaissance |

---

## 2. Threat Actors

### 2.1 External Attackers

| Actor Profile | Motivation | Capability | Likelihood |
|--------------|------------|------------|------------|
| Script Kiddies | Vandalism, bragging rights | Low - automated tools | Medium |
| Cybercriminals | Financial gain, ransomware | Medium - exploit frameworks | Medium |
| Advanced Persistent Threats (APT) | Espionage, supply chain attack | High - zero-days, resources | Low |
| Competitors | Business intelligence | Medium - targeted attacks | Low |

### 2.2 Malicious Tenants (Multi-Tenant Isolation)

| Actor Profile | Motivation | Capability | Likelihood |
|--------------|------------|------------|------------|
| Curious Tenant | Access other tenant data | Medium - API manipulation | Medium |
| Malicious Insider | Data theft, sabotage | High - legitimate access | Low |
| Compromised Account | Pivot point for attacker | Variable | Medium |

### 2.3 Compromised CI/CD Systems

| Actor Profile | Motivation | Capability | Likelihood |
|--------------|------------|------------|------------|
| Supply Chain Attacker | Code injection, persistence | High - trusted context | Low |
| Misconfigured Pipeline | Accidental exposure | N/A - configuration error | Medium |
| Stolen CI Credentials | Unauthorized deployments | Medium - scope limited | Medium |

---

## 3. Attack Vectors (STRIDE Analysis)

### 3.1 Spoofing (S)

#### S-001: OAuth Token Theft
- **Description:** Attacker intercepts or steals OAuth tokens during authentication flow
- **Attack Path:** Man-in-the-middle, XSS, phishing
- **Assets Affected:** User credentials, repository access
- **Severity:** Critical
- **Mitigations:**
  - [x] OAuth2 PKCE flow implementation
  - [x] HTTPS-only communication (HSTS)
  - [x] HttpOnly, Secure, SameSite=Strict cookies
  - [ ] Token binding (future enhancement)
- **Status:** MITIGATED

#### S-002: API Key Impersonation
- **Description:** Attacker uses stolen or leaked API key to access platform
- **Attack Path:** Key leakage in logs, repositories, or compromised systems
- **Assets Affected:** Tenant data, API access
- **Severity:** High
- **Mitigations:**
  - [x] API keys hashed with bcrypt (never stored plaintext)
  - [x] Key rotation support
  - [x] Per-key scope restrictions
  - [x] Rate limiting per key
  - [ ] Key usage anomaly detection (planned)
- **Status:** MITIGATED

#### S-003: Session Hijacking
- **Description:** Attacker takes over authenticated user session
- **Attack Path:** Session fixation, cookie theft, network sniffing
- **Assets Affected:** User account, tenant data
- **Severity:** High
- **Mitigations:**
  - [x] Session regeneration on authentication
  - [x] Secure cookie attributes
  - [x] Session timeout (30 minutes idle)
  - [x] Single active session enforcement (optional)
- **Status:** MITIGATED

#### S-004: JWT Token Forgery
- **Description:** Attacker crafts valid-appearing JWT without proper signing
- **Attack Path:** Algorithm confusion, key leakage, weak secrets
- **Assets Affected:** Authentication bypass
- **Severity:** Critical
- **Mitigations:**
  - [x] RS256 asymmetric signing only
  - [x] Algorithm whitelist (reject 'none', HS256)
  - [x] Issuer and audience validation
  - [x] Short token lifetime (15 minutes access, 7 days refresh)
- **Status:** MITIGATED

---

### 3.2 Tampering (T)

#### T-001: Graph Data Manipulation
- **Description:** Attacker modifies dependency graph data to hide vulnerabilities
- **Attack Path:** SQL injection, API parameter manipulation, direct DB access
- **Assets Affected:** Scan integrity, audit trail
- **Severity:** High
- **Mitigations:**
  - [x] Parameterized queries (no string concatenation)
  - [x] Input validation with TypeBox schemas
  - [x] RLS policies enforce tenant isolation
  - [x] Audit logging of all modifications
- **Status:** MITIGATED

#### T-002: Scan Result Modification
- **Description:** Attacker alters scan results to suppress security findings
- **Attack Path:** API manipulation, database tampering
- **Assets Affected:** Security posture visibility
- **Severity:** High
- **Mitigations:**
  - [x] Immutable scan records (append-only design)
  - [x] Cryptographic checksums on results
  - [x] Audit trail for all operations
  - [ ] Result signing (planned)
- **Status:** MITIGATED

#### T-003: Configuration Tampering
- **Description:** Attacker modifies platform configuration to weaken security
- **Attack Path:** Admin account compromise, config file manipulation
- **Assets Affected:** Platform security controls
- **Severity:** Critical
- **Mitigations:**
  - [x] Configuration validation on startup
  - [x] Environment variable isolation
  - [x] Admin action audit logging
  - [x] Infrastructure-as-code for deployment
- **Status:** MITIGATED

---

### 3.3 Repudiation (R)

#### R-001: Audit Log Deletion
- **Description:** Attacker deletes audit logs to cover malicious activity
- **Attack Path:** Database access, admin account compromise
- **Assets Affected:** Forensic capability, compliance
- **Severity:** High
- **Mitigations:**
  - [x] Append-only audit log table
  - [x] No DELETE permissions on audit tables
  - [x] Log shipping to external SIEM
  - [ ] Blockchain-anchored checksums (future)
- **Status:** MITIGATED

#### R-002: Action Denial
- **Description:** User denies performing sensitive action
- **Attack Path:** Insufficient logging, log manipulation
- **Assets Affected:** Accountability
- **Severity:** Medium
- **Mitigations:**
  - [x] Comprehensive action logging
  - [x] IP address and user agent capture
  - [x] Timestamp with NTP synchronization
  - [x] Correlation IDs for request tracing
- **Status:** MITIGATED

#### R-003: Timeline Manipulation
- **Description:** Attacker modifies timestamps to create false alibis
- **Attack Path:** Database access, system time manipulation
- **Assets Affected:** Forensic timeline
- **Severity:** Medium
- **Mitigations:**
  - [x] Database-generated timestamps (NOW())
  - [x] Server time synchronization (NTP)
  - [x] Timestamp immutability
- **Status:** MITIGATED

---

### 3.4 Information Disclosure (I)

#### I-001: Cross-Tenant Data Leakage
- **Description:** Tenant A accesses Tenant B's data through isolation bypass
- **Attack Path:** Missing tenant filter, IDOR, SQL injection
- **Assets Affected:** Tenant confidentiality
- **Severity:** Critical
- **Mitigations:**
  - [x] Row-Level Security (RLS) policies on all tables
  - [x] Tenant ID injection in all queries
  - [x] API-level tenant validation
  - [x] Security tests for cross-tenant access
- **Status:** MITIGATED

#### I-002: Credential Exposure in Logs
- **Description:** Sensitive credentials logged in plaintext
- **Attack Path:** Log aggregation access, log file exposure
- **Assets Affected:** All credentials
- **Severity:** Critical
- **Mitigations:**
  - [x] Pino redaction rules for sensitive fields
  - [x] Automated secret scanning in CI/CD
  - [x] Log sanitization middleware
  - [x] Security tests verify no credential logging
- **Status:** MITIGATED

#### I-003: Repository Token Extraction
- **Description:** Attacker extracts stored repository access tokens
- **Attack Path:** Database breach, memory dump, backup exposure
- **Assets Affected:** Repository access
- **Severity:** Critical
- **Mitigations:**
  - [x] Tokens encrypted at rest (AES-256-GCM)
  - [x] Encryption keys in secure key management
  - [x] Token scoping to minimum required permissions
  - [ ] Hardware Security Module (HSM) integration (planned)
- **Status:** MITIGATED

#### I-004: Error Message Information Leakage
- **Description:** Detailed error messages expose system internals
- **Attack Path:** Triggering errors, fuzzing
- **Assets Affected:** System architecture knowledge
- **Severity:** Medium
- **Mitigations:**
  - [x] Generic error messages in production
  - [x] Stack trace suppression
  - [x] Error codes for debugging (not details)
  - [x] Centralized error handling
- **Status:** MITIGATED

---

### 3.5 Denial of Service (D)

#### D-001: Graph Query Flooding
- **Description:** Attacker sends expensive graph queries to exhaust resources
- **Attack Path:** API abuse, amplification attacks
- **Assets Affected:** Service availability
- **Severity:** High
- **Mitigations:**
  - [x] Query complexity limits
  - [x] Rate limiting per tenant/IP
  - [x] Query timeout (30 seconds)
  - [x] Connection pooling limits
- **Status:** MITIGATED

#### D-002: Scan Queue Exhaustion
- **Description:** Attacker floods scan queue with large repository requests
- **Attack Path:** Rapid scan submissions, large repo targeting
- **Assets Affected:** Processing capacity
- **Severity:** High
- **Mitigations:**
  - [x] Per-tenant scan concurrency limits
  - [x] Repository size limits
  - [x] Queue depth monitoring
  - [x] Backpressure mechanisms
- **Status:** MITIGATED

#### D-003: Resource Starvation
- **Description:** Attacker consumes all available memory/CPU/connections
- **Attack Path:** Large payload submission, connection holding
- **Assets Affected:** Service availability
- **Severity:** High
- **Mitigations:**
  - [x] Request body size limits (10MB)
  - [x] Connection timeouts
  - [x] Memory limits per request
  - [x] Circuit breaker pattern
- **Status:** MITIGATED

#### D-004: ReDoS (Regular Expression DoS)
- **Description:** Malicious input causes catastrophic regex backtracking
- **Attack Path:** Crafted HCL content, file paths
- **Assets Affected:** Parser availability
- **Severity:** Medium
- **Mitigations:**
  - [x] Regex complexity review
  - [x] Input length limits before regex
  - [x] Regex timeout mechanisms
  - [ ] Replace complex regex with parsers (ongoing)
- **Status:** PARTIALLY MITIGATED

---

### 3.6 Elevation of Privilege (E)

#### E-001: Tenant Isolation Bypass
- **Description:** Standard tenant gains access to admin functions or other tenants
- **Attack Path:** Parameter manipulation, IDOR, missing authorization checks
- **Assets Affected:** Multi-tenant integrity
- **Severity:** Critical
- **Mitigations:**
  - [x] Tenant ID derived from JWT, not request
  - [x] RLS enforced at database level
  - [x] Authorization middleware on all routes
  - [x] Penetration testing for isolation
- **Status:** MITIGATED

#### E-002: Admin Role Escalation
- **Description:** Regular user gains administrative privileges
- **Attack Path:** JWT manipulation, role injection
- **Assets Affected:** Platform administration
- **Severity:** Critical
- **Mitigations:**
  - [x] Role claims signed in JWT
  - [x] Server-side role verification
  - [x] Principle of least privilege
  - [x] Admin action logging
- **Status:** MITIGATED

#### E-003: RLS Policy Circumvention
- **Description:** Attacker bypasses Row-Level Security through SQL injection or policy gaps
- **Attack Path:** SQL injection, policy misconfiguration
- **Assets Affected:** All tenant data
- **Severity:** Critical
- **Mitigations:**
  - [x] Parameterized queries only
  - [x] No direct SQL execution from user input
  - [x] RLS policy audit and testing
  - [x] TypeBox schema validation
- **Status:** MITIGATED

#### E-004: API Key Scope Escalation
- **Description:** API key used for operations beyond its granted scope
- **Attack Path:** Missing scope validation, scope injection
- **Assets Affected:** Unauthorized operations
- **Severity:** High
- **Mitigations:**
  - [x] Scope validation on every request
  - [x] Minimal default scopes
  - [x] Scope-based rate limiting
  - [x] Scope audit logging
- **Status:** MITIGATED

---

## 4. Trust Boundaries

```
+------------------------------------------------------------------+
|                        INTERNET (Untrusted)                       |
+------------------------------------------------------------------+
                                |
                         [WAF/CDN Edge]
                                |
+------------------------------------------------------------------+
|                     DMZ (Semi-Trusted)                            |
|  +------------------+  +------------------+  +------------------+ |
|  |  Load Balancer   |  |   Rate Limiter   |  |    API Gateway   | |
|  +------------------+  +------------------+  +------------------+ |
+------------------------------------------------------------------+
                                |
                    [Authentication Boundary]
                                |
+------------------------------------------------------------------+
|                   Application Tier (Trusted)                      |
|  +------------------+  +------------------+  +------------------+ |
|  |   API Server     |  |   Job Workers    |  |  Background Jobs | |
|  +------------------+  +------------------+  +------------------+ |
+------------------------------------------------------------------+
                                |
                    [Tenant Isolation Boundary]
                                |
+------------------------------------------------------------------+
|                      Data Tier (Highly Trusted)                   |
|  +------------------+  +------------------+  +------------------+ |
|  |   PostgreSQL     |  |      Redis       |  |       S3         | |
|  |   (with RLS)     |  |   (ephemeral)    |  |  (encrypted)     | |
|  +------------------+  +------------------+  +------------------+ |
+------------------------------------------------------------------+
```

---

## 5. Data Flow Diagram

```
[User Browser]
      |
      | (1) HTTPS Request + JWT
      v
[API Gateway]
      |
      | (2) Validate JWT, Extract tenant_id
      v
[Application Server]
      |
      | (3) SET app.tenant_id = 'xxx'
      v
[PostgreSQL with RLS]
      |
      | (4) RLS Policy: tenant_id = current_setting('app.tenant_id')
      v
[Data Access]
      |
      | (5) Return tenant-scoped data only
      v
[Response]
```

---

## 6. Risk Assessment Matrix

| Threat ID | Threat | Likelihood | Impact | Risk Score | Status |
|-----------|--------|------------|--------|------------|--------|
| S-001 | OAuth Token Theft | Low | Critical | Medium | Mitigated |
| S-002 | API Key Impersonation | Medium | High | High | Mitigated |
| S-003 | Session Hijacking | Low | High | Medium | Mitigated |
| S-004 | JWT Token Forgery | Low | Critical | Medium | Mitigated |
| T-001 | Graph Data Manipulation | Low | High | Medium | Mitigated |
| T-002 | Scan Result Modification | Low | High | Medium | Mitigated |
| T-003 | Configuration Tampering | Low | Critical | Medium | Mitigated |
| R-001 | Audit Log Deletion | Low | High | Medium | Mitigated |
| R-002 | Action Denial | Low | Medium | Low | Mitigated |
| R-003 | Timeline Manipulation | Low | Medium | Low | Mitigated |
| I-001 | Cross-Tenant Data Leakage | Medium | Critical | High | Mitigated |
| I-002 | Credential Exposure in Logs | Low | Critical | Medium | Mitigated |
| I-003 | Repository Token Extraction | Low | Critical | Medium | Mitigated |
| I-004 | Error Message Leakage | Medium | Low | Low | Mitigated |
| D-001 | Graph Query Flooding | High | High | High | Mitigated |
| D-002 | Scan Queue Exhaustion | Medium | High | High | Mitigated |
| D-003 | Resource Starvation | Medium | High | High | Mitigated |
| D-004 | ReDoS | Medium | Medium | Medium | Partial |
| E-001 | Tenant Isolation Bypass | Low | Critical | Medium | Mitigated |
| E-002 | Admin Role Escalation | Low | Critical | Medium | Mitigated |
| E-003 | RLS Policy Circumvention | Low | Critical | Medium | Mitigated |
| E-004 | API Key Scope Escalation | Low | High | Medium | Mitigated |

---

## 7. Residual Risks

### 7.1 Accepted Risks

| Risk | Rationale | Compensating Controls |
|------|-----------|----------------------|
| ReDoS in HCL Parser | Complex regex required for HCL parsing | Input size limits, timeouts |
| Third-party OAuth Provider | Dependency on GitHub/GitLab availability | Token caching, graceful degradation |

### 7.2 Deferred Mitigations

| Mitigation | Timeline | Justification |
|------------|----------|---------------|
| HSM Integration | Q3 2026 | Cost-benefit analysis pending |
| Token Binding | Q4 2026 | Browser support limited |
| Blockchain Audit Anchoring | 2027 | Evaluating alternatives |

---

## 8. Review and Maintenance

- **Next Review Date:** 2026-05-05 (Quarterly)
- **Review Triggers:** Major feature release, security incident, architecture change
- **Maintainers:** Security Team, Platform Architecture Team

---

## Appendix A: STRIDE Reference

| Category | Description |
|----------|-------------|
| **S**poofing | Impersonating something or someone else |
| **T**ampering | Modifying data or code |
| **R**epudiation | Claiming not to have performed an action |
| **I**nformation Disclosure | Exposing information to unauthorized parties |
| **D**enial of Service | Denying or degrading service |
| **E**levation of Privilege | Gaining capabilities without proper authorization |

---

## Appendix B: Related Documents

- Security Audit Checklist: `/docs/security/audit-checklist.md`
- Penetration Test Scope: `/docs/security/pentest-scope.md`
- Security Test Suite: `/api/tests/security/`
- Incident Response Plan: `/docs/security/incident-response.md`
