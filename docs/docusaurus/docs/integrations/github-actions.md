---
id: github-actions
title: GitHub Actions Integration
sidebar_position: 1
description: Integrate DMP with GitHub Actions for automated dependency analysis
---

# GitHub Actions Integration

Integrate the Dependency Mapping Platform with GitHub Actions to automatically analyze dependencies on every push or pull request.

## Quick Start

Add this workflow to your repository:

```yaml
# .github/workflows/dependency-analysis.yml
name: Dependency Analysis

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Trigger DMP Scan
        uses: code-reviewer/dmp-action@v1
        with:
          api-key: ${{ secrets.DMP_API_KEY }}
          repository-id: ${{ secrets.DMP_REPO_ID }}

      - name: Get Scan Results
        uses: code-reviewer/dmp-results@v1
        with:
          api-key: ${{ secrets.DMP_API_KEY }}
          scan-id: ${{ steps.scan.outputs.scan-id }}
```

## Setup

### 1. Create an API Key

1. Go to **Settings > API Keys** in the DMP web app
2. Create a new key with these scopes:
   - `read:repositories`
   - `write:scans`
   - `read:scans`
   - `read:graphs`
3. Copy the key

### 2. Add Repository Secrets

In your GitHub repository:

1. Go to **Settings > Secrets and variables > Actions**
2. Add these secrets:

| Secret | Value |
|--------|-------|
| `DMP_API_KEY` | Your API key |
| `DMP_REPO_ID` | Your DMP repository ID |

### 3. Find Your Repository ID

Get your repository ID from the DMP web app URL:

```
https://app.code-reviewer.io/repositories/{repository-id}
```

Or via API:

```bash
curl -X GET "https://api.code-reviewer.io/api/v1/repositories?name=my-repo" \
  -H "Authorization: Bearer $DMP_API_KEY"
```

## Workflow Examples

### Basic Scan on Push

```yaml
name: DMP Scan

on:
  push:
    branches: [main, develop]
    paths:
      - '**/*.tf'
      - '**/*.hcl'
      - '**/Chart.yaml'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trigger Scan
        id: scan
        run: |
          RESPONSE=$(curl -s -X POST \
            "https://api.code-reviewer.io/api/v1/scans" \
            -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repositoryId": "${{ secrets.DMP_REPO_ID }}",
              "commitSha": "${{ github.sha }}",
              "branch": "${{ github.ref_name }}"
            }')
          SCAN_ID=$(echo $RESPONSE | jq -r '.id')
          echo "scan-id=$SCAN_ID" >> $GITHUB_OUTPUT

      - name: Wait for Completion
        run: |
          while true; do
            STATUS=$(curl -s \
              "https://api.code-reviewer.io/api/v1/scans/${{ steps.scan.outputs.scan-id }}/status" \
              -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" | jq -r '.status')

            if [[ "$STATUS" == "completed" ]]; then
              echo "Scan completed successfully"
              break
            elif [[ "$STATUS" == "failed" ]]; then
              echo "Scan failed"
              exit 1
            fi

            echo "Status: $STATUS - waiting..."
            sleep 10
          done
```

### Pull Request Comments

Post scan results as PR comments:

```yaml
name: DMP PR Analysis

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Trigger Scan
        id: scan
        run: |
          # Trigger scan and get ID
          SCAN_ID=$(curl -s -X POST \
            "https://api.code-reviewer.io/api/v1/scans" \
            -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repositoryId": "${{ secrets.DMP_REPO_ID }}",
              "commitSha": "${{ github.event.pull_request.head.sha }}",
              "branch": "${{ github.head_ref }}"
            }' | jq -r '.id')

          echo "scan-id=$SCAN_ID" >> $GITHUB_OUTPUT

          # Wait for completion
          for i in {1..60}; do
            STATUS=$(curl -s \
              "https://api.code-reviewer.io/api/v1/scans/$SCAN_ID/status" \
              -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" | jq -r '.status')

            [[ "$STATUS" == "completed" ]] && break
            [[ "$STATUS" == "failed" ]] && exit 1
            sleep 5
          done

      - name: Get Results
        id: results
        run: |
          RESULTS=$(curl -s \
            "https://api.code-reviewer.io/api/v1/scans/${{ steps.scan.outputs.scan-id }}" \
            -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}")

          NODE_COUNT=$(echo $RESULTS | jq -r '.nodeCount')
          EDGE_COUNT=$(echo $RESULTS | jq -r '.edgeCount')

          echo "node-count=$NODE_COUNT" >> $GITHUB_OUTPUT
          echo "edge-count=$EDGE_COUNT" >> $GITHUB_OUTPUT

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const scanId = '${{ steps.scan.outputs.scan-id }}';
            const nodeCount = '${{ steps.results.outputs.node-count }}';
            const edgeCount = '${{ steps.results.outputs.edge-count }}';

            const body = `## Dependency Analysis Results

            | Metric | Value |
            |--------|-------|
            | Resources | ${nodeCount} |
            | Dependencies | ${edgeCount} |

            [View Full Graph](https://app.code-reviewer.io/scans/${scanId}/graph)
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### Blast Radius Check

Block PRs with high-impact changes:

```yaml
name: Blast Radius Check

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - '**/*.tf'
      - '**/*.hcl'

jobs:
  blast-radius:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get Changed Files
        id: changes
        run: |
          FILES=$(curl -s \
            "https://api.github.com/repos/${{ github.repository }}/pulls/${{ github.event.number }}/files" \
            -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" | \
            jq -r '.[] | select(.filename | test("\\.(tf|hcl)$")) | .filename')

          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Analyze Impact
        id: impact
        run: |
          # Trigger scan on PR branch
          SCAN_ID=$(curl -s -X POST \
            "https://api.code-reviewer.io/api/v1/scans" \
            -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repositoryId": "${{ secrets.DMP_REPO_ID }}",
              "commitSha": "${{ github.event.pull_request.head.sha }}",
              "branch": "${{ github.head_ref }}"
            }' | jq -r '.id')

          # Wait for completion
          for i in {1..60}; do
            STATUS=$(curl -s \
              "https://api.code-reviewer.io/api/v1/scans/$SCAN_ID/status" \
              -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" | jq -r '.status')

            [[ "$STATUS" == "completed" ]] && break
            [[ "$STATUS" == "failed" ]] && exit 1
            sleep 5
          done

          # Get impact analysis for changed files
          IMPACT=$(curl -s -X POST \
            "https://api.code-reviewer.io/api/v1/scans/$SCAN_ID/impact" \
            -H "Authorization: Bearer ${{ secrets.DMP_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "filePaths": ${{ toJson(steps.changes.outputs.files) }}
            }')

          MAX_IMPACT=$(echo $IMPACT | jq -r '.maxImpactScore')
          echo "max-impact=$MAX_IMPACT" >> $GITHUB_OUTPUT

      - name: Check Threshold
        run: |
          MAX_IMPACT=${{ steps.impact.outputs.max-impact }}

          if (( $(echo "$MAX_IMPACT > 0.8" | bc -l) )); then
            echo "::error::High impact change detected (score: $MAX_IMPACT)"
            echo "This change affects critical infrastructure. Please get approval from the infrastructure team."
            exit 1
          elif (( $(echo "$MAX_IMPACT > 0.6" | bc -l) )); then
            echo "::warning::Moderate impact change detected (score: $MAX_IMPACT)"
          fi
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DMP_API_URL` | API base URL (default: https://api.code-reviewer.io) |
| `DMP_API_KEY` | Your API key |
| `DMP_REPO_ID` | Repository ID in DMP |

## Webhook Integration

For faster feedback, configure webhooks instead of polling:

1. In DMP, go to **Repository Settings > Webhooks**
2. Add your GitHub Actions webhook URL
3. DMP will trigger your workflow when scans complete

See [Webhook Configuration](/repositories/webhook-configuration) for details.

## Troubleshooting

### Scan Not Starting

- Verify API key has `write:scans` scope
- Check repository ID is correct
- Ensure repository is active in DMP

### Timeout Waiting for Scan

- Large repositories may take longer
- Increase wait time or use webhooks
- Check scan status for errors

### Permission Denied

- Verify API key hasn't expired
- Check scopes include required permissions
- Ensure key is for correct tenant

## Next Steps

- [GitLab CI Integration](/integrations/gitlab-ci) - GitLab pipeline setup
- [Terraform Cloud](/integrations/terraform-cloud) - Integrate with TFC
- [Slack Notifications](/integrations/slack-notifications) - Get alerts
