---
id: gitlab-ci
title: GitLab CI Integration
sidebar_position: 2
description: Integrate DMP with GitLab CI/CD for automated dependency analysis
---

# GitLab CI Integration

Integrate the Dependency Mapping Platform with GitLab CI/CD to automatically analyze dependencies on every push or merge request.

## Quick Start

Add this job to your `.gitlab-ci.yml`:

```yaml
dependency-analysis:
  stage: test
  image: curlimages/curl:latest
  variables:
    DMP_API_URL: "https://api.code-reviewer.io"
  script:
    - |
      # Trigger scan
      SCAN_RESPONSE=$(curl -s -X POST \
        "${DMP_API_URL}/api/v1/scans" \
        -H "Authorization: Bearer ${DMP_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryId\": \"${DMP_REPO_ID}\",
          \"commitSha\": \"${CI_COMMIT_SHA}\",
          \"branch\": \"${CI_COMMIT_REF_NAME}\"
        }")

      SCAN_ID=$(echo $SCAN_RESPONSE | jq -r '.id')
      echo "Scan ID: $SCAN_ID"

      # Wait for completion
      for i in $(seq 1 60); do
        STATUS=$(curl -s \
          "${DMP_API_URL}/api/v1/scans/${SCAN_ID}/status" \
          -H "Authorization: Bearer ${DMP_API_KEY}" | jq -r '.status')

        echo "Status: $STATUS"

        if [ "$STATUS" = "completed" ]; then
          echo "Scan completed successfully"
          exit 0
        elif [ "$STATUS" = "failed" ]; then
          echo "Scan failed"
          exit 1
        fi

        sleep 5
      done

      echo "Scan timed out"
      exit 1
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## Setup

### 1. Create an API Key

1. Go to **Settings > API Keys** in the DMP web app
2. Create a new key with scopes:
   - `read:repositories`
   - `write:scans`
   - `read:scans`
   - `read:graphs`
3. Copy the key

### 2. Add CI/CD Variables

In GitLab:

1. Go to **Settings > CI/CD > Variables**
2. Add these variables:

| Variable | Value | Masked | Protected |
|----------|-------|--------|-----------|
| `DMP_API_KEY` | Your API key | Yes | Optional |
| `DMP_REPO_ID` | Repository ID | No | No |

### 3. Find Your Repository ID

Get your repository ID from the DMP URL or API:

```bash
curl -X GET "https://api.code-reviewer.io/api/v1/repositories?name=my-repo" \
  -H "Authorization: Bearer $DMP_API_KEY" | jq '.data[0].id'
```

## Pipeline Examples

### Basic Scan

```yaml
stages:
  - analyze

dmp-scan:
  stage: analyze
  image: curlimages/curl:latest
  script:
    - apk add --no-cache jq
    - |
      SCAN_ID=$(curl -s -X POST \
        "https://api.code-reviewer.io/api/v1/scans" \
        -H "Authorization: Bearer ${DMP_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryId\": \"${DMP_REPO_ID}\",
          \"commitSha\": \"${CI_COMMIT_SHA}\",
          \"branch\": \"${CI_COMMIT_REF_NAME}\"
        }" | jq -r '.id')

      echo "SCAN_ID=${SCAN_ID}" >> scan.env
  artifacts:
    reports:
      dotenv: scan.env
  rules:
    - if: $CI_COMMIT_BRANCH
      changes:
        - "**/*.tf"
        - "**/*.hcl"
        - "**/Chart.yaml"
```

### Merge Request Comments

Post results to merge requests:

```yaml
dmp-mr-analysis:
  stage: analyze
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      # Trigger and wait for scan
      SCAN_ID=$(curl -s -X POST \
        "https://api.code-reviewer.io/api/v1/scans" \
        -H "Authorization: Bearer ${DMP_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryId\": \"${DMP_REPO_ID}\",
          \"commitSha\": \"${CI_COMMIT_SHA}\",
          \"branch\": \"${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}\"
        }" | jq -r '.id')

      # Wait for completion
      while true; do
        STATUS=$(curl -s \
          "https://api.code-reviewer.io/api/v1/scans/${SCAN_ID}/status" \
          -H "Authorization: Bearer ${DMP_API_KEY}" | jq -r '.status')

        [ "$STATUS" = "completed" ] && break
        [ "$STATUS" = "failed" ] && exit 1
        sleep 5
      done

      # Get results
      RESULTS=$(curl -s \
        "https://api.code-reviewer.io/api/v1/scans/${SCAN_ID}" \
        -H "Authorization: Bearer ${DMP_API_KEY}")

      NODE_COUNT=$(echo $RESULTS | jq -r '.nodeCount')
      EDGE_COUNT=$(echo $RESULTS | jq -r '.edgeCount')

      # Post comment to MR
      COMMENT="## Dependency Analysis Results\n\n| Metric | Value |\n|--------|-------|\n| Resources | ${NODE_COUNT} |\n| Dependencies | ${EDGE_COUNT} |\n\n[View Full Graph](https://app.code-reviewer.io/scans/${SCAN_ID}/graph)"

      curl -X POST \
        "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/merge_requests/${CI_MERGE_REQUEST_IID}/notes" \
        -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"body\": \"${COMMENT}\"}"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### Blast Radius Gate

Block high-impact changes:

```yaml
dmp-blast-radius-check:
  stage: analyze
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq bc
  script:
    - |
      # Get changed files
      CHANGED_FILES=$(git diff --name-only ${CI_MERGE_REQUEST_DIFF_BASE_SHA}...${CI_COMMIT_SHA} | grep -E '\.(tf|hcl)$' || true)

      if [ -z "$CHANGED_FILES" ]; then
        echo "No infrastructure files changed"
        exit 0
      fi

      # Trigger scan
      SCAN_ID=$(curl -s -X POST \
        "https://api.code-reviewer.io/api/v1/scans" \
        -H "Authorization: Bearer ${DMP_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryId\": \"${DMP_REPO_ID}\",
          \"commitSha\": \"${CI_COMMIT_SHA}\",
          \"branch\": \"${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}\"
        }" | jq -r '.id')

      # Wait for completion
      for i in $(seq 1 60); do
        STATUS=$(curl -s \
          "https://api.code-reviewer.io/api/v1/scans/${SCAN_ID}/status" \
          -H "Authorization: Bearer ${DMP_API_KEY}" | jq -r '.status')

        [ "$STATUS" = "completed" ] && break
        [ "$STATUS" = "failed" ] && exit 1
        sleep 5
      done

      # Impact analysis
      FILES_JSON=$(echo "$CHANGED_FILES" | jq -R -s -c 'split("\n") | map(select(length > 0))')

      IMPACT=$(curl -s -X POST \
        "https://api.code-reviewer.io/api/v1/scans/${SCAN_ID}/impact" \
        -H "Authorization: Bearer ${DMP_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"filePaths\": ${FILES_JSON}}")

      MAX_IMPACT=$(echo $IMPACT | jq -r '.maxImpactScore')

      echo "Maximum impact score: $MAX_IMPACT"

      # Check threshold
      if [ $(echo "$MAX_IMPACT > 0.8" | bc -l) -eq 1 ]; then
        echo "ERROR: High impact change detected!"
        echo "Please get approval from the infrastructure team."
        exit 1
      elif [ $(echo "$MAX_IMPACT > 0.6" | bc -l) -eq 1 ]; then
        echo "WARNING: Moderate impact change detected"
      fi
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  allow_failure: false
```

### Scheduled Full Scan

```yaml
dmp-scheduled-scan:
  stage: analyze
  image: curlimages/curl:latest
  script:
    - |
      curl -s -X POST \
        "https://api.code-reviewer.io/api/v1/scans" \
        -H "Authorization: Bearer ${DMP_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryId\": \"${DMP_REPO_ID}\",
          \"branch\": \"main\"
        }"
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

## Using DMP Components

### Include Component

```yaml
include:
  - component: code-reviewer/dmp-components/scan@v1
    inputs:
      api_key: $DMP_API_KEY
      repository_id: $DMP_REPO_ID
```

### Component Definition

Create a reusable component in `.gitlab/components/dmp-scan.yml`:

```yaml
spec:
  inputs:
    api_key:
      description: "DMP API Key"
    repository_id:
      description: "DMP Repository ID"
    branch:
      default: $CI_COMMIT_REF_NAME
    impact_threshold:
      default: "0.8"
---
dmp-scan:
  stage: analyze
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      SCAN_ID=$(curl -s -X POST \
        "https://api.code-reviewer.io/api/v1/scans" \
        -H "Authorization: Bearer $[[ inputs.api_key ]]" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryId\": \"$[[ inputs.repository_id ]]\",
          \"commitSha\": \"${CI_COMMIT_SHA}\",
          \"branch\": \"$[[ inputs.branch ]]\"
        }" | jq -r '.id')

      echo "Scan started: $SCAN_ID"
```

## Webhook Configuration

For faster feedback, configure GitLab webhooks:

1. In DMP, go to **Repository Settings > Webhooks**
2. Copy the webhook URL
3. In GitLab, go to **Settings > Webhooks**
4. Add the URL with these events:
   - Push events
   - Merge request events

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DMP_API_KEY` | API authentication key | Yes |
| `DMP_REPO_ID` | Repository ID in DMP | Yes |
| `DMP_API_URL` | API base URL | No (default: https://api.code-reviewer.io) |
| `GITLAB_TOKEN` | GitLab token for MR comments | For MR comments |

## Troubleshooting

### Pipeline Hangs

- Check API key permissions
- Verify network connectivity to DMP API
- Increase timeout in script

### Scan Not Starting

- Verify repository ID is correct
- Check API key hasn't expired
- Ensure repository is active in DMP

### MR Comments Not Posting

- Verify `GITLAB_TOKEN` has API access
- Check token has access to the project
- Ensure proper variable masking

## Next Steps

- [GitHub Actions](/integrations/github-actions) - Alternative CI setup
- [Terraform Cloud](/integrations/terraform-cloud) - TFC integration
- [API Reference](/api) - Full API documentation
