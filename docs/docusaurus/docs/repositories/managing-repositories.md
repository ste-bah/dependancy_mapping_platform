---
id: managing-repositories
title: Managing Repositories
sidebar_position: 2
description: How to update, configure, and remove repositories
---

# Managing Repositories

This guide covers managing your existing repositories in the Dependency Mapping Platform.

## Repository Dashboard

Access your repositories from the main navigation:

1. Click **Repositories** in the sidebar
2. View all tracked repositories in a grid or list view
3. Use filters to find specific repositories

### Repository Cards

Each repository card shows:

- **Name**: Owner/repository format
- **Provider**: GitHub, GitLab, or Bitbucket icon
- **Status**: Connection and scan status
- **Last Scan**: Time since last successful scan
- **Node Count**: Number of resources in latest scan

## Repository Settings

### Accessing Settings

1. Click on a repository card to open the detail page
2. Click the **Settings** tab or gear icon
3. Configure options as needed

### General Settings

| Setting | Description |
|---------|-------------|
| **Display Name** | Custom name (optional) |
| **Default Branch** | Branch for scheduled scans |
| **Active** | Enable/disable scanning |
| **Description** | Notes about the repository |

### Branch Tracking

Track multiple branches for analysis:

```yaml
# Tracked branches configuration
tracked_branches:
  - main
  - develop
  - release/*
```

**To add branches:**

1. Go to **Settings > Branch Tracking**
2. Click **Add Branch**
3. Enter branch name or pattern
4. Save changes

### Scan Configuration

Customize how scans are performed:

```yaml
scan_config:
  # File patterns to include
  include:
    - "**/*.tf"
    - "**/*.hcl"
    - "**/terragrunt.hcl"
    - "**/Chart.yaml"
    - "**/values*.yaml"

  # Patterns to exclude
  exclude:
    - "**/node_modules/**"
    - "**/.terraform/**"
    - "**/vendor/**"
    - "**/.git/**"

  # Parser options
  options:
    terraform_version: "1.5"
    parse_modules: true
    resolve_variables: true
```

### Webhook Settings

Configure automatic scan triggers:

1. Go to **Settings > Webhooks**
2. Toggle **Auto-scan on push**
3. Copy the webhook URL
4. Configure in your Git provider

See [Webhook Configuration](/repositories/webhook-configuration) for detailed setup.

## Updating Repositories

### Update Repository Settings

1. Navigate to repository settings
2. Modify desired fields
3. Click **Save Changes**

Changes take effect immediately for new scans.

### Refresh Repository Metadata

To sync with Git provider:

1. Click the **Refresh** button on the repository card
2. Metadata (branches, default branch) will be updated

### Re-authenticate Connection

If connection issues occur:

1. Go to **Settings > Connection**
2. Click **Re-authenticate**
3. Complete OAuth flow
4. Connection will be refreshed

## Viewing Repository Details

### Overview Tab

Shows repository summary:

- Connection status
- Recent scan activity
- Quick statistics
- Action buttons

### Scans Tab

Lists all scans for the repository:

- Scan history with status
- Duration and node counts
- Filter by status, branch, date

### Settings Tab

Repository configuration options (detailed above).

## Scan Management

### Manual Scans

Trigger a scan manually:

1. Click **Trigger Scan** button
2. Select branch (default: main)
3. Optionally specify commit SHA
4. Click **Start Scan**

### Scan History

View past scans:

1. Go to **Scans** tab
2. Filter by:
   - Status (completed, failed, pending)
   - Branch
   - Date range
3. Click a scan to view details

### Comparing Scans

Compare two scans:

1. Select two scans from the list
2. Click **Compare**
3. View graph diff showing changes

## Removing Repositories

### Deactivate vs Delete

| Action | Effect |
|--------|--------|
| **Deactivate** | Stops scanning, preserves data |
| **Delete** | Removes repository and all data |

### Deactivate a Repository

1. Go to **Settings**
2. Toggle **Active** to off
3. Confirm deactivation

Repository data remains accessible but no new scans occur.

### Delete a Repository

1. Go to **Settings**
2. Scroll to **Danger Zone**
3. Click **Delete Repository**
4. Type repository name to confirm
5. Click **Delete**

**Warning**: Deletion is permanent. All scan history and data will be removed.

## Bulk Operations

### Select Multiple Repositories

1. Enable **Bulk Mode** from the toolbar
2. Check repositories to select
3. Choose action from dropdown

### Available Bulk Actions

| Action | Description |
|--------|-------------|
| **Trigger Scans** | Start scans for all selected |
| **Deactivate** | Disable all selected |
| **Activate** | Enable all selected |
| **Delete** | Remove all selected (requires confirmation) |

## Repository Limits

### Plan Limits

| Plan | Max Repositories |
|------|-----------------|
| Free | 3 |
| Pro | 25 |
| Enterprise | Unlimited |

### Approaching Limits

When near your limit:

- Warning banner appears on dashboard
- "Add Repository" shows remaining slots
- Consider upgrading or removing unused repositories

## Best Practices

### Repository Organization

- Use consistent naming conventions
- Group related repositories in rollups
- Remove inactive repositories to reduce clutter

### Scan Configuration

- Exclude unnecessary directories (node_modules, .terraform)
- Track only branches you need to analyze
- Use webhooks for real-time updates

### Maintenance

- Review inactive repositories quarterly
- Update default branches after repository changes
- Monitor scan failures and address issues

## Troubleshooting

### Repository Shows "Error"

1. Check if repository still exists
2. Verify OAuth permissions
3. Try re-authenticating

### Scans Consistently Failing

1. Check scan error messages
2. Validate Terraform/HCL syntax locally
3. Review file include/exclude patterns

### Webhook Not Triggering

See [Webhook Configuration](/repositories/webhook-configuration) for troubleshooting.

## Next Steps

- [Webhook Configuration](/repositories/webhook-configuration) - Set up automatic scanning
- [Running Scans](/scans/running-scans) - Learn about scan options
- [Cross-Repo Analysis](/advanced/cross-repo-analysis) - Aggregate multiple repositories
