# Research Plan: E2E Testing Implementation

## Executive Summary

**Status**: Complete
**Total Tasks**: 28
**Critical Path Duration**: 12 days (8 hours/day)
**Parallel Paths**: 4
**Quality Gates**: 6
**Research Areas**: 5 unknowns requiring resolution

**Research Goal**: Create comprehensive E2E tests for all major user flows in the IaC Dependency Detection system with 85%+ confidence in test coverage and validation approaches.

## Identified Unknowns

### Unknown 1: OAuth Flow Testing (CRITICAL)

**Question**: How to properly mock GitHub OAuth callback flow without compromising security test integrity?

**Current State**:
- Auth tests exist in `/api/tests/security/auth.test.ts` but focus on unit-level validation
- GitHub OAuth integration not tested E2E
- Environment variables set in `tests/setup.ts`: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

**Research Tasks**:

| ID | Task | Priority | Duration | Dependencies |
|----|------|----------|----------|--------------|
| R1.1 | Research MSW (Mock Service Worker) GitHub OAuth patterns | HIGH | 4h | None |
| R1.2 | Investigate @octokit/rest mocking strategies | HIGH | 3h | None |
| R1.3 | Evaluate test-oauth-server packages | MEDIUM | 2h | None |
| R1.4 | Research state parameter validation in mock OAuth | HIGH | 2h | R1.1 |
| R1.5 | Design token exchange mock pattern | HIGH | 3h | R1.1, R1.2 |

**Hypotheses**:
1. MSW can intercept GitHub OAuth endpoints at network level
2. Fastify inject can simulate callback with state validation
3. JWT mock tokens can simulate authenticated state

**Quality Gate 1**: OAuth Mock Design Complete
- [ ] Mock pattern documented with sequence diagram
- [ ] Security considerations addressed
- [ ] State/CSRF validation approach defined
- [ ] Token refresh flow included

---

### Unknown 2: Database Transaction Testing with RLS (CRITICAL)

**Question**: How to test Row Level Security (RLS) policies with Testcontainers while maintaining tenant isolation verification?

**Current State**:
- Docker-compose uses ParadeDB (PostgreSQL extension)
- RLS policies mentioned in auth tests but not validated E2E
- Current setup mocks `pg` module entirely

**Research Tasks**:

| ID | Task | Priority | Duration | Dependencies |
|----|------|----------|----------|--------------|
| R2.1 | Research Testcontainers PostgreSQL configuration | HIGH | 3h | None |
| R2.2 | Investigate ParadeDB container availability | HIGH | 2h | R2.1 |
| R2.3 | Design RLS policy test fixtures | CRITICAL | 4h | R2.1 |
| R2.4 | Research pg_trgm and vector extension requirements | MEDIUM | 2h | R2.2 |
| R2.5 | Evaluate pg connection pooling in test context | MEDIUM | 2h | R2.1 |
| R2.6 | Design multi-tenant test isolation patterns | HIGH | 3h | R2.3 |

**Hypotheses**:
1. Standard postgres:16 container can apply RLS via migrations
2. `SET app.tenant_id` can be used to switch tenant context
3. Transaction rollback maintains test isolation

**Quality Gate 2**: Database Test Strategy Complete
- [ ] Container initialization script created
- [ ] RLS verification tests designed
- [ ] Tenant switching mechanism documented
- [ ] Performance baseline for DB tests established (<5s per test)

---

### Unknown 3: Cross-Tool Detection Accuracy (HIGH)

**Question**: How to validate confidence scores and detection accuracy for cross-tool dependencies (Terraform -> Helm, CloudFormation -> Kubernetes)?

**Current State**:
- Scoring engine tests exist (`/api/tests/scoring/scoring-engine.test.ts`)
- Confidence thresholds defined: certain(95), high(80), medium(60), low(40)
- No E2E validation of multi-tool detection accuracy

**Research Tasks**:

| ID | Task | Priority | Duration | Dependencies |
|----|------|----------|----------|--------------|
| R3.1 | Research golden dataset creation patterns | HIGH | 3h | None |
| R3.2 | Investigate precision/recall metrics for dependency detection | HIGH | 4h | None |
| R3.3 | Design cross-tool fixture library | HIGH | 4h | R3.1 |
| R3.4 | Research confidence score validation methodology | HIGH | 3h | R3.2 |
| R3.5 | Evaluate snapshot testing for graph outputs | MEDIUM | 2h | R3.3 |

**Hypotheses**:
1. Golden datasets from real IaC repositories can establish accuracy baselines
2. F1 score > 0.85 is acceptable for dependency detection
3. Snapshot testing can catch regression in detection confidence

**Quality Gate 3**: Accuracy Validation Framework Complete
- [ ] Golden dataset format defined (at least 100 dependency pairs)
- [ ] Accuracy metrics documented (precision, recall, F1)
- [ ] Threshold validation criteria established
- [ ] Cross-tool test scenarios defined (5+ combinations)

---

### Unknown 4: CI/CD Integration (HIGH)

**Question**: How to run Docker-dependent tests (Testcontainers, PostgreSQL, Redis) in GitHub Actions?

**Current State**:
- No `.github/workflows` directory found
- Docker-compose exists with postgres, redis, minio services
- Tests currently mock all external dependencies

**Research Tasks**:

| ID | Task | Priority | Duration | Dependencies |
|----|------|----------|----------|--------------|
| R4.1 | Research GitHub Actions services vs Testcontainers | HIGH | 2h | None |
| R4.2 | Investigate GitHub Actions Docker-in-Docker support | HIGH | 2h | R4.1 |
| R4.3 | Design test matrix for node versions (20, 22) | MEDIUM | 1h | None |
| R4.4 | Research test parallelization with containers | MEDIUM | 2h | R4.1 |
| R4.5 | Evaluate caching strategies for container images | MEDIUM | 2h | R4.2 |
| R4.6 | Design failure recovery and retry patterns | HIGH | 2h | R4.1 |

**Hypotheses**:
1. GitHub Actions services can replace Testcontainers for simpler setup
2. Docker-in-Docker works but has security implications
3. Container image caching can reduce CI time by 50%+

**Quality Gate 4**: CI Configuration Complete
- [ ] GitHub Actions workflow created and validated
- [ ] Container startup time < 60 seconds
- [ ] Test parallelization configured
- [ ] Failure notifications configured

---

### Unknown 5: Performance Baselines (MEDIUM)

**Question**: What are acceptable timing thresholds for E2E tests across different user flows?

**Current State**:
- Unit tests have 30s timeout (`vitest.config.ts`: `testTimeout: 30000`)
- Performance tests exist but focus on processing time, not E2E
- Scan workflow test checks `processingTimeMs < 5000`

**Research Tasks**:

| ID | Task | Priority | Duration | Dependencies |
|----|------|----------|----------|--------------|
| R5.1 | Research E2E test timing best practices | MEDIUM | 2h | None |
| R5.2 | Benchmark current integration tests | HIGH | 3h | None |
| R5.3 | Design timeout tiers (fast/medium/slow) | MEDIUM | 2h | R5.2 |
| R5.4 | Research flaky test detection patterns | MEDIUM | 2h | None |
| R5.5 | Evaluate test parallelization impact on timing | MEDIUM | 2h | R5.2 |

**Hypotheses**:
1. E2E tests should complete within 30s for fast flows, 60s for complex flows
2. Database-dependent tests add 2-5s overhead
3. Flaky tests often correlate with timing issues near thresholds

**Quality Gate 5**: Performance Baselines Established
- [ ] Timing categories defined (fast < 5s, medium < 15s, slow < 30s)
- [ ] Baseline measurements for 10+ user flows
- [ ] Flaky test mitigation strategies documented
- [ ] CI timeout configuration aligned with baselines

---

## Complete Task List (28 Tasks)

### Phase 1: Research Foundation (Days 1-3)

| ID | Task | Type | Dependencies | Agent | Duration | Priority |
|----|------|------|--------------|-------|----------|----------|
| T1 | Setup research environment | Setup | None | researcher | 2h | CRITICAL |
| T2 | Inventory existing test patterns | Analysis | T1 | code-analyzer | 3h | HIGH |
| T3 | Execute R1.1-R1.3 (OAuth research) | Research | T1 | researcher | 9h | CRITICAL |
| T4 | Execute R2.1-R2.2 (DB research) | Research | T1 | researcher | 5h | CRITICAL |
| T5 | Execute R3.1-R3.2 (Accuracy research) | Research | T1 | researcher | 7h | HIGH |

### Phase 2: Deep Investigation (Days 4-6)

| ID | Task | Type | Dependencies | Agent | Duration | Priority |
|----|------|------|--------------|-------|----------|----------|
| T6 | Execute R1.4-R1.5 (OAuth design) | Design | T3 | system-architect | 5h | CRITICAL |
| T7 | Execute R2.3-R2.6 (DB design) | Design | T4 | system-architect | 11h | CRITICAL |
| T8 | Execute R3.3-R3.5 (Accuracy design) | Design | T5 | system-architect | 9h | HIGH |
| T9 | Execute R4.1-R4.3 (CI research) | Research | T1 | researcher | 5h | HIGH |
| T10 | Execute R5.1-R5.3 (Performance research) | Research | T1, T2 | perf-analyzer | 7h | MEDIUM |

### Phase 3: Validation & Quality Gates (Days 7-8)

| ID | Task | Type | Dependencies | Agent | Duration | Priority |
|----|------|------|--------------|-------|----------|----------|
| T11 | Quality Gate 1: OAuth Design Review | Validation | T6 | reviewer | 2h | CRITICAL |
| T12 | Quality Gate 2: DB Strategy Review | Validation | T7 | reviewer | 2h | CRITICAL |
| T13 | Quality Gate 3: Accuracy Framework Review | Validation | T8 | reviewer | 2h | HIGH |
| T14 | Execute R4.4-R4.6 (CI completion) | Research | T9 | researcher | 6h | HIGH |
| T15 | Execute R5.4-R5.5 (Performance completion) | Research | T10 | perf-analyzer | 4h | MEDIUM |

### Phase 4: Documentation & Integration (Days 9-10)

| ID | Task | Type | Dependencies | Agent | Duration | Priority |
|----|------|------|--------------|-------|----------|----------|
| T16 | Quality Gate 4: CI Config Review | Validation | T14 | reviewer | 2h | HIGH |
| T17 | Quality Gate 5: Performance Baseline Review | Validation | T15 | reviewer | 2h | MEDIUM |
| T18 | Document OAuth mock implementation guide | Documentation | T11 | coder | 4h | HIGH |
| T19 | Document DB test strategy guide | Documentation | T12 | coder | 4h | HIGH |
| T20 | Document accuracy validation guide | Documentation | T13 | coder | 3h | HIGH |

### Phase 5: Prototype & Proof of Concept (Days 11-12)

| ID | Task | Type | Dependencies | Agent | Duration | Priority |
|----|------|------|--------------|-------|----------|----------|
| T21 | Prototype OAuth E2E test | Implementation | T18 | tester | 4h | HIGH |
| T22 | Prototype DB RLS E2E test | Implementation | T19 | tester | 4h | HIGH |
| T23 | Create golden dataset fixtures | Implementation | T20 | tester | 3h | HIGH |
| T24 | Prototype CI workflow | Implementation | T16 | cicd-engineer | 3h | HIGH |
| T25 | Run benchmark tests | Validation | T17, T21, T22 | perf-analyzer | 3h | MEDIUM |

### Phase 6: Final Validation (Day 12)

| ID | Task | Type | Dependencies | Agent | Duration | Priority |
|----|------|------|--------------|-------|----------|----------|
| T26 | Quality Gate 6: Final Integration Review | Validation | T21-T25 | reviewer | 3h | CRITICAL |
| T27 | Update research findings document | Documentation | T26 | coder | 2h | HIGH |
| T28 | Create implementation recommendations | Documentation | T26 | system-architect | 3h | HIGH |

---

## Dependency Graph

```
T1 (Setup)
  ├── T2 (Inventory)
  │     └── T10 (Perf Research) → T15 → T17 → T25
  │
  ├── T3 (OAuth Research) → T6 (Design) → T11 (QG1) → T18 → T21
  ├── T4 (DB Research) → T7 (Design) → T12 (QG2) → T19 → T22
  ├── T5 (Accuracy Research) → T8 (Design) → T13 (QG3) → T20 → T23
  └── T9 (CI Research) → T14 (CI Complete) → T16 (QG4) → T24
                                                          │
                                                          ▼
                    T21 + T22 + T23 + T24 + T25 ────────► T26 (Final QG)
                                                          │
                                                          ▼
                                                    T27 + T28 (Docs)
```

**Critical Path**: T1 → T3 → T6 → T11 → T18 → T21 → T26 → T28

---

## Quality Gates (6 Total)

### Quality Gate 1: OAuth Mock Design Complete
**Trigger**: After T6
**Criteria**:
- [ ] Mock intercept points documented for GitHub OAuth endpoints
- [ ] State parameter validation approach specified
- [ ] Token exchange flow diagrammed
- [ ] Security implications documented
- [ ] Alternative approaches compared (MSW vs manual mock vs test server)

**STOP Decision**: If mock cannot preserve security validation intent
**PROCEED Decision**: If design addresses CSRF, token validation, and user context

---

### Quality Gate 2: Database Test Strategy Complete
**Trigger**: After T7
**Criteria**:
- [ ] Container initialization time < 30 seconds
- [ ] RLS policy test approach validated with PoC
- [ ] Multi-tenant isolation mechanism documented
- [ ] Migration execution in test context defined
- [ ] Connection pooling behavior under test load understood

**STOP Decision**: If RLS cannot be tested without production-like complexity
**PROCEED Decision**: If tenant isolation is verifiable and test setup < 30s

---

### Quality Gate 3: Accuracy Validation Framework Complete
**Trigger**: After T8
**Criteria**:
- [ ] Golden dataset format defined (JSON schema)
- [ ] At least 20 cross-tool dependency pairs documented
- [ ] Accuracy metrics calculation implemented
- [ ] Threshold validation (F1 > 0.80 for production readiness)
- [ ] Regression detection approach defined

**STOP Decision**: If no reliable ground truth available for validation
**PROCEED Decision**: If metrics can be computed and thresholds are reasonable

---

### Quality Gate 4: CI Configuration Complete
**Trigger**: After T14
**Criteria**:
- [ ] GitHub Actions workflow syntax validated
- [ ] Container services defined and tested
- [ ] Test parallelization configured (max 4 parallel jobs)
- [ ] Cache strategy implemented (node_modules, docker layers)
- [ ] Timeout and retry behavior defined

**STOP Decision**: If Docker-in-Docker has insurmountable security issues
**PROCEED Decision**: If workflow runs successfully in test repository

---

### Quality Gate 5: Performance Baselines Established
**Trigger**: After T15
**Criteria**:
- [ ] At least 10 user flows benchmarked
- [ ] Timing tiers assigned to each flow
- [ ] P95 response times documented
- [ ] Flaky test candidates identified
- [ ] CI timeout values calculated (P95 + 20% buffer)

**STOP Decision**: If baseline variance > 50% (unstable tests)
**PROCEED Decision**: If P95 values are stable across 5 runs

---

### Quality Gate 6: Final Integration Review
**Trigger**: After T21-T25
**Criteria**:
- [ ] OAuth prototype test passes
- [ ] DB RLS prototype test passes
- [ ] Golden dataset loads correctly
- [ ] CI workflow completes successfully
- [ ] All performance baselines within tolerance
- [ ] Research findings documented with confidence levels

**STOP Decision**: If any prototype fails with no clear fix path
**PROCEED Decision**: If all prototypes succeed and findings are documented

---

## Contingency Plans

### Contingency: OAuth Mock Complexity (R1)

**Risk**: MSW cannot intercept GitHub OAuth at required level
**Probability**: 25%
**Mitigation**:
1. Use Fastify inject to bypass network entirely
2. Create mock OAuth state machine in test setup
3. Consider wiremock for complex OAuth scenarios

---

### Contingency: ParadeDB Container Unavailable (R2)

**Risk**: No official ParadeDB container for testing
**Probability**: 30%
**Mitigation**:
1. Use standard postgres:16 with pgvector extension
2. Skip ParadeDB-specific features in E2E tests
3. Create custom Dockerfile extending postgres

---

### Contingency: Golden Dataset Creation Difficulty (R3)

**Risk**: Real IaC repositories have ambiguous dependencies
**Probability**: 35%
**Mitigation**:
1. Create synthetic golden datasets with known dependencies
2. Use multiple annotators for real-world examples
3. Accept lower initial accuracy threshold (F1 > 0.70)

---

### Contingency: CI Container Instability (R4)

**Risk**: Testcontainers inconsistent in GitHub Actions
**Probability**: 40%
**Mitigation**:
1. Use native GitHub Actions services (postgres, redis)
2. Add retry logic with exponential backoff
3. Consider separate integration test workflow

---

### Contingency: Performance Baseline Variance (R5)

**Risk**: E2E test timing varies > 50% between runs
**Probability**: 30%
**Mitigation**:
1. Increase sample size (10 runs) for baseline
2. Use percentile-based thresholds (P95)
3. Isolate flaky tests to separate suite

---

## Resource Requirements

### Tools & Libraries to Evaluate

| Tool | Purpose | Evaluation Priority |
|------|---------|---------------------|
| MSW (Mock Service Worker) | Network-level mocking for OAuth | HIGH |
| @testcontainers/postgresql | PostgreSQL container management | HIGH |
| vitest-mock-extended | Deep mock utilities | MEDIUM |
| supertest | HTTP testing (already installed) | N/A |
| @faker-js/faker | Test data generation (already installed) | N/A |

### Knowledge Base

| Resource | URL | Purpose |
|----------|-----|---------|
| MSW OAuth Guide | https://mswjs.io/docs/recipes/oauth2 | OAuth mocking patterns |
| Testcontainers Node | https://node.testcontainers.org/ | Container test setup |
| Vitest Mocking | https://vitest.dev/guide/mocking.html | Test doubles best practices |
| GitHub Actions Services | https://docs.github.com/en/actions/using-containerized-services | CI container setup |

---

## Success Criteria

**Research Plan is successful when**:
- [ ] All 5 unknowns have documented mitigation strategies
- [ ] All 6 quality gates have clear STOP/PROCEED criteria
- [ ] All 28 tasks have completion criteria defined
- [ ] Prototype tests validate research findings
- [ ] Implementation recommendations are actionable
- [ ] 85%+ confidence in recommended approaches

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Days 1-3 | Research foundation, initial findings |
| Phase 2 | Days 4-6 | Deep investigation, design patterns |
| Phase 3 | Days 7-8 | Quality gates 1-5 validation |
| Phase 4 | Days 9-10 | Documentation, implementation guides |
| Phase 5 | Days 11-12 | Prototypes, proof of concept |
| Phase 6 | Day 12 | Final review, recommendations |

**Total Duration**: 12 days at 8 hours/day (96 hours)

---

## File Organization

All research outputs should be stored in:
- `/docs/e2e-testing/` - Research documentation
- `/docs/e2e-testing/guides/` - Implementation guides
- `/api/tests/e2e/` - E2E test implementations
- `/api/tests/fixtures/golden/` - Golden datasets for accuracy validation
- `/.github/workflows/` - CI configuration

---

*Generated by ReWOO Research Planner - Agent #10 of 47*
*Research Plan Version: 1.0*
*Created: 2026-02-04*
