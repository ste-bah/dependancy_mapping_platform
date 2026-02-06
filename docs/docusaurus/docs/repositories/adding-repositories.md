---
id: adding-repositories
title: Adding Repositories
sidebar_position: 1
description: How to add and configure repositories for dependency analysis
---

# Adding Repositories

This guide explains how to add repositories to the Dependency Mapping Platform for analysis.

## Prerequisites

Before adding a repository, ensure you have:

1. A GitHub, GitLab, or Bitbucket account with access to the repository
2. Completed the OAuth authentication flow
3. Appropriate permissions on the repository (at least read access)

## Adding a Repository

### From the Dashboard

1. Navigate to the **Dashboard**
2. Click the **"Add Repository"** button in the Quick Actions section
3. A modal will appear showing your available repositories

### From the Repositories Page

1. Go to **Repositories** in the navigation menu
2. Click the **"Add Repository"** button in the top right
3. Select from the list of available repositories

## Repository Selection

The repository selection modal shows:

| Column | Description |
|--------|-------------|
| **Name** | Repository name with owner/organization |
| **Provider** | GitHub, GitLab, or Bitbucket icon |
| **Stars** | Repository star count |
| **Last Updated** | When the repository was last pushed to |
| **Status** | Whether already added or available |

### Filtering Repositories

Use the search box to filter repositories by name. The search is case-insensitive and matches partial names.

### Pagination

If you have many repositories, use the pagination controls at the bottom of the modal to navigate through pages.

## Configuration Options

When adding a repository, you can configure:

### Branch Tracking

- **Default Branch**: Automatically detected (main or master)
- **Additional Branches**: Add more branches to track if needed

### Scan Settings

- **Auto-scan on Push**: Enable webhook-triggered scans (recommended)
- **Scan Concurrency**: Maximum concurrent scans for this repository

### File Patterns

Configure which files to include or exclude from scanning:

```yaml
# Default include patterns
include:
  - "**/*.tf"
  - "**/*.hcl"
  - "**/terragrunt.hcl"
  - "**/Chart.yaml"
  - "**/values*.yaml"

# Default exclude patterns
exclude:
  - "**/node_modules/**"
  - "**/.terraform/**"
  - "**/vendor/**"
```

## Post-Addition Setup

After adding a repository:

### 1. Verify Connection

The repository card will show a connection status indicator:

| Status | Meaning |
|--------|---------|
| Connected | Repository successfully linked |
| Pending | Webhook setup in progress |
| Error | Connection issue (check permissions) |

### 2. Configure Webhooks (Recommended)

For automatic scanning on push:

1. Go to the repository detail page
2. Navigate to **Settings > Webhooks**
3. Click **"Configure Webhook"**
4. Follow the provider-specific instructions

See [Webhook Configuration](/repositories/webhook-configuration) for detailed setup guides.

### 3. Run Initial Scan

Trigger your first scan to populate the dependency graph:

1. Click **"Trigger Scan"** on the repository card or detail page
2. Wait for the scan to complete
3. View results on the scan detail page

## Repository Limits

| Plan | Max Repositories | Concurrent Scans |
|------|-----------------|------------------|
| Free | 3 | 1 |
| Pro | 25 | 5 |
| Enterprise | Unlimited | Configurable |

## Supported Repository Structures

DMP supports various repository structures:

### Monorepo

```
my-infrastructure/
  environments/
    dev/
      terragrunt.hcl
    staging/
      terragrunt.hcl
    production/
      terragrunt.hcl
  modules/
    vpc/
      main.tf
    eks/
      main.tf
```

### Multi-Module Repository

```
infrastructure/
  network/
    main.tf
    variables.tf
  compute/
    main.tf
    variables.tf
  database/
    main.tf
    variables.tf
```

### Helm Charts Repository

```
charts/
  app-one/
    Chart.yaml
    values.yaml
    templates/
  app-two/
    Chart.yaml
    values.yaml
    templates/
```

## Troubleshooting

### Repository Not Appearing

1. Verify your OAuth token has access to the repository
2. Check if the repository is private and requires additional scopes
3. Try refreshing your repository list

### Permission Denied

1. Ensure you have at least read access to the repository
2. For organization repositories, verify the OAuth app is approved
3. Check organization settings for third-party app restrictions

### Webhook Not Working

See [Webhook Configuration](/repositories/webhook-configuration) for troubleshooting steps.

## Next Steps

- [Managing Repositories](/repositories/managing-repositories) - Update and remove repositories
- [Webhook Configuration](/repositories/webhook-configuration) - Set up automatic scanning
- [Running Scans](/scans/running-scans) - Learn about scan options
