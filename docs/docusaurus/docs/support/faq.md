---
id: faq
title: Frequently Asked Questions
sidebar_position: 2
description: Answers to common questions about the Dependency Mapping Platform
---

# Frequently Asked Questions

## General Questions

### What is the Dependency Mapping Platform?

The Dependency Mapping Platform (DMP) is an infrastructure-as-code analysis tool that visualizes dependencies between your Terraform, Terragrunt, Helm, and Kubernetes resources. It helps you understand how your infrastructure components relate to each other and assess the impact of changes.

### What infrastructure tools are supported?

DMP currently supports:

| Tool | Version Support |
|------|----------------|
| Terraform | 0.12+ |
| Terragrunt | 0.30+ |
| Helm | v3 |
| Kubernetes | Via Helm templates |

### How is my data secured?

DMP implements enterprise-grade security:

- **Encryption**: All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- **Multi-tenant isolation**: Row-level security ensures tenant data separation
- **OAuth integration**: No passwords stored, uses GitHub/GitLab OAuth
- **Audit logging**: All actions are logged for compliance
- **SOC 2 compliance**: (In progress for production)

See our [Security Documentation](/security) for details.

### Is there a free tier?

Yes! The free tier includes:

- Up to 3 repositories
- 1 concurrent scan
- 30-day scan history
- Basic graph visualization

## Account & Access

### How do I create an account?

1. Visit [app.code-reviewer.io](https://app.code-reviewer.io)
2. Click "Sign in with GitHub" or "Sign in with GitLab"
3. Authorize the application
4. You're ready to go!

### Can I use my GitLab account?

Yes, DMP supports both GitHub and GitLab OAuth. Select "Sign in with GitLab" on the login page.

### How do I add team members?

Team management is available on Pro and Enterprise plans:

1. Go to **Settings > Team**
2. Click **"Invite Member"**
3. Enter their email address
4. Select their role (Admin, Member, Viewer)
5. They'll receive an invitation email

### What roles are available?

| Role | Permissions |
|------|------------|
| **Owner** | Full access, billing, team management |
| **Admin** | Full access except billing |
| **Member** | Add repos, run scans, view graphs |
| **Viewer** | Read-only access to all data |

## Repositories

### How do I add a private repository?

Private repositories require proper OAuth permissions:

1. During sign-in, ensure you grant access to private repositories
2. For organization repositories, an org admin may need to approve the OAuth app
3. If issues persist, re-authenticate to refresh permissions

### Can I analyze multiple branches?

Yes, you can track multiple branches:

1. Go to **Repository Settings**
2. Under **Branch Tracking**, add additional branches
3. Each branch will be analyzed separately

### What if my repository is too large?

For very large repositories (>1GB or >100k files):

1. Configure **exclusion patterns** to skip unnecessary files
2. Use `.dmpignore` file (similar to `.gitignore`)
3. Contact support for enterprise options

### Can I analyze monorepos?

Yes, DMP handles monorepos well. It will:

- Detect all Terraform/Helm configurations
- Build relationships across the entire repo
- Allow filtering by directory path

## Scans

### How long does a scan take?

Scan duration depends on repository size:

| Repository Size | Typical Duration |
|----------------|-----------------|
| Small (<100 files) | 10-30 seconds |
| Medium (100-1000 files) | 30 seconds - 2 minutes |
| Large (1000-10000 files) | 2-5 minutes |
| Very large (>10000 files) | 5-15 minutes |

### How often should I scan?

We recommend:

- **Push-triggered scans**: For active development branches
- **Scheduled daily scans**: For main/production branches
- **Manual scans**: After major refactoring

### Can I scan specific directories?

Yes, configure include patterns in repository settings:

```yaml
include:
  - "infrastructure/terraform/**/*.tf"
  - "infrastructure/helm/**"
```

### What happens if a scan fails?

When a scan fails:

1. The scan status shows "failed"
2. Error details are available on the scan page
3. Previous successful scan results remain available
4. You can retry after fixing the issue

## Graphs

### How do I read the dependency graph?

- **Nodes**: Represent resources (color-coded by type)
- **Edges**: Show relationships (dependencies flow from source to target)
- **Click a node**: View details and connections
- See [Understanding Graphs](/graphs/understanding-graphs) for a complete guide

### What is blast radius?

Blast radius shows all resources that could be affected if you change a specific resource. It includes:

- **Direct dependents**: Resources that directly depend on the selected resource
- **Transitive dependents**: Resources affected through dependency chains

See [Blast Radius Analysis](/graphs/blast-radius) for details.

### Can I export the graph?

Yes, you can export graphs:

1. Click the **Export** button in the toolbar
2. Choose format:
   - **PNG/SVG**: Visual export for presentations
   - **JSON**: Structured data for processing
   - **DOT**: Graphviz format

### Why are some dependencies missing?

DMP relies on static analysis. Some dependencies may be missed if:

- They're created dynamically at runtime
- They use complex expressions that can't be statically analyzed
- They reference external resources not in the repository

## API & Integration

### How do I get an API key?

1. Go to **Settings > API Keys**
2. Click **"Create New Key"**
3. Enter a name and select scopes
4. Copy the key (shown only once!)

See [API Authentication](/api/authentication) for details.

### What's the API rate limit?

| Authentication | Rate Limit |
|---------------|------------|
| API Key | 1000 requests/minute |
| OAuth Token | 100 requests/minute |
| Unauthenticated | Not allowed |

### Can I use DMP in CI/CD?

Yes! DMP integrates with:

- [GitHub Actions](/integrations/github-actions)
- [GitLab CI](/integrations/gitlab-ci)
- [Terraform Cloud](/integrations/terraform-cloud)

### Is there a webhook for scan completion?

Yes, configure webhooks to receive notifications:

1. Go to **Repository Settings > Webhooks**
2. Add your endpoint URL
3. Select events to receive

## Pricing & Plans

### How do I upgrade my plan?

1. Go to **Settings > Billing**
2. Click **"Upgrade Plan"**
3. Select your desired plan
4. Complete payment

### Do you offer annual billing?

Yes, annual billing provides a 20% discount. Contact sales@code-reviewer.io for enterprise pricing.

### Can I cancel my subscription?

Yes, you can cancel anytime:

1. Go to **Settings > Billing**
2. Click **"Cancel Subscription"**
3. Access continues until end of billing period

### Is there a trial period?

Yes, Pro plan features are available free for 14 days. No credit card required.

## Support

### How do I report a bug?

1. Email support@code-reviewer.io
2. Include:
   - Description of the issue
   - Steps to reproduce
   - Browser/environment details
   - Screenshots if helpful

### Where can I request features?

Submit feature requests through:

1. In-app feedback (click the feedback button)
2. Email to feedback@code-reviewer.io
3. GitHub Discussions (for public features)

### What's the support response time?

| Plan | Response Time |
|------|--------------|
| Free | Best effort (48-72 hours) |
| Pro | 24 hours |
| Enterprise | 4 hours (business hours) |

### Is there a status page?

Yes, check [status.code-reviewer.io](https://status.code-reviewer.io) for:

- Current service status
- Planned maintenance
- Incident history

## Still Have Questions?

If your question isn't answered here:

1. Search the [documentation](/)
2. Check [Troubleshooting](/support/troubleshooting)
3. Contact support@code-reviewer.io
