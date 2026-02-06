---
id: webhook-configuration
title: Webhook Configuration
sidebar_position: 3
description: Configure webhooks for automatic dependency scanning
---

# Webhook Configuration

Webhooks enable automatic scanning when code is pushed to your repository. This guide covers setting up webhooks for different Git providers.

## Overview

With webhooks configured:

1. You push code to your repository
2. Git provider sends webhook to DMP
3. DMP triggers a scan automatically
4. Results are available within minutes

## GitHub Webhooks

### Automatic Setup (Recommended)

DMP can configure webhooks automatically:

1. Go to **Repository Settings > Webhooks** in DMP
2. Click **Configure Webhook Automatically**
3. Authorize the webhook creation
4. Webhook is created and active

### Manual Setup

If automatic setup isn't available:

#### Step 1: Get Webhook Details

In DMP:
1. Go to **Repository Settings > Webhooks**
2. Copy the **Webhook URL**
3. Copy the **Webhook Secret**

#### Step 2: Create Webhook in GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings > Webhooks**
3. Click **Add webhook**
4. Configure:

| Field | Value |
|-------|-------|
| Payload URL | Webhook URL from DMP |
| Content type | `application/json` |
| Secret | Webhook Secret from DMP |
| SSL verification | Enable |

5. Select events:
   - **Just the push event** (recommended), or
   - **Let me select individual events**: Push

6. Click **Add webhook**

### Verify Setup

After creating the webhook:

1. Make a small commit to your repository
2. Check GitHub webhook deliveries for success
3. Verify scan appears in DMP

## GitLab Webhooks

### Step 1: Get Webhook Details

In DMP:
1. Go to **Repository Settings > Webhooks**
2. Copy the **Webhook URL**
3. Copy the **Webhook Secret**

### Step 2: Create Webhook in GitLab

1. Go to your project in GitLab
2. Navigate to **Settings > Webhooks**
3. Configure:

| Field | Value |
|-------|-------|
| URL | Webhook URL from DMP |
| Secret token | Webhook Secret from DMP |
| Trigger | Push events |
| SSL verification | Enable |

4. Click **Add webhook**

### Test Webhook

1. Click **Test** next to the webhook
2. Select **Push events**
3. Verify delivery success

## Bitbucket Webhooks

### Step 1: Get Webhook Details

In DMP:
1. Go to **Repository Settings > Webhooks**
2. Copy the **Webhook URL**
3. Note: Bitbucket uses different authentication

### Step 2: Create Webhook in Bitbucket

1. Go to your repository in Bitbucket
2. Navigate to **Repository settings > Webhooks**
3. Click **Add webhook**
4. Configure:

| Field | Value |
|-------|-------|
| Title | DMP Dependency Analysis |
| URL | Webhook URL from DMP |
| Triggers | Repository: Push |

5. Click **Save**

### Authentication

Bitbucket webhooks include authentication in the URL. DMP provides a unique URL with embedded credentials.

## Webhook Events

### Supported Events

| Event | Provider | Description |
|-------|----------|-------------|
| Push | All | Code pushed to any branch |
| Pull Request | GitHub, GitLab | PR/MR opened or updated |
| Tag | All | New tag created |

### Event Configuration

Configure which events trigger scans:

```yaml
webhook_config:
  events:
    - push
  branches:
    - main
    - develop
    - feature/*
  ignore_paths:
    - "*.md"
    - "docs/**"
```

## Branch Filtering

Control which branches trigger scans:

### Include Specific Branches

```yaml
# Only scan these branches
branches:
  include:
    - main
    - develop
    - release/*
```

### Exclude Branches

```yaml
# Scan all except these
branches:
  exclude:
    - dependabot/*
    - renovate/*
```

## Path Filtering

Trigger scans only when relevant files change:

### Include Patterns

```yaml
# Only trigger on infrastructure files
paths:
  include:
    - "**/*.tf"
    - "**/*.hcl"
    - "**/Chart.yaml"
```

### Exclude Patterns

```yaml
# Ignore documentation changes
paths:
  exclude:
    - "**/*.md"
    - "docs/**"
    - ".github/**"
```

## Security

### Webhook Secrets

- Secrets are used to verify webhook authenticity
- Never share or expose webhook secrets
- Rotate secrets periodically

### Regenerating Secrets

1. Go to **Repository Settings > Webhooks**
2. Click **Regenerate Secret**
3. Copy new secret
4. Update in Git provider

### IP Allowlisting

DMP webhook endpoints accept requests from:
- GitHub IP ranges
- GitLab IP ranges
- Bitbucket IP ranges

Enterprise customers can configure additional restrictions.

## Troubleshooting

### Webhook Not Delivering

**Check in Git Provider:**
1. Go to webhook settings
2. View recent deliveries
3. Look for error messages

**Common Causes:**
- Invalid URL
- Secret mismatch
- Network/firewall blocking

### Webhook Delivers but No Scan

**Check:**
1. Branch is tracked in DMP
2. Changed files match include patterns
3. Repository is active

**Debug:**
```bash
# Check webhook payload
curl -X POST "https://api.code-reviewer.io/api/v1/webhooks/test" \
  -H "Authorization: Bearer $DMP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"repositoryId": "xxx"}'
```

### Signature Verification Failed

**Cause:** Secret mismatch between Git provider and DMP

**Solution:**
1. Regenerate secret in DMP
2. Copy exact secret (no extra spaces)
3. Update in Git provider
4. Test webhook

### Duplicate Scans

**Cause:** Multiple webhooks configured

**Solution:**
1. Check all webhook configurations
2. Remove duplicate webhooks
3. Keep only one active webhook

### Delayed Webhook Processing

**Possible Causes:**
- High queue volume
- Rate limiting

**Check:**
1. View DMP status page
2. Check scan queue status
3. Contact support if persistent

## Advanced Configuration

### Custom Headers

For enterprise deployments with proxies:

```yaml
webhook_config:
  custom_headers:
    X-Forwarded-For: allowed
    X-Real-IP: allowed
```

### Retry Configuration

DMP retries failed webhook processing:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5 | 1 hour |

### Webhook Logs

View webhook processing logs:

1. Go to **Repository Settings > Webhooks**
2. Click **View Logs**
3. Filter by status, date

## Best Practices

1. **Use secrets**: Always configure webhook secrets
2. **Branch filtering**: Only scan relevant branches
3. **Path filtering**: Avoid scanning on documentation changes
4. **Monitor deliveries**: Check webhook health regularly
5. **Rotate secrets**: Update secrets quarterly

## Next Steps

- [Running Scans](/scans/running-scans) - Manual scan options
- [CI/CD Integration](/integrations/github-actions) - Pipeline automation
- [Troubleshooting](/support/troubleshooting) - Common issues
