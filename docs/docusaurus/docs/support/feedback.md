---
id: feedback
title: Share Feedback
sidebar_position: 4
description: How to share feedback and feature requests with the DMP team
---

# Share Your Feedback

Your feedback is invaluable in making the Dependency Mapping Platform better. We actively use feedback to prioritize features and improve the user experience.

## Ways to Share Feedback

### In-App Feedback

The quickest way to share feedback:

1. Click the **feedback button** (speech bubble icon) in the bottom-right corner
2. Select feedback type:
   - **Bug Report**: Something isn't working
   - **Feature Request**: Suggest an improvement
   - **General Feedback**: Share your thoughts
3. Describe your feedback
4. Optionally attach a screenshot
5. Click **Submit**

### Email

Send detailed feedback to: **feedback@code-reviewer.io**

For bug reports, please include:
- Description of the issue
- Steps to reproduce
- Expected vs. actual behavior
- Browser and operating system
- Screenshots if applicable

### Support Tickets

For urgent issues or account-specific feedback:

1. Go to **Settings > Support**
2. Click **"Create Ticket"**
3. Select priority level
4. Describe the issue
5. Track responses in your ticket history

## What Happens to Your Feedback

### Bug Reports

1. **Acknowledgment**: You'll receive confirmation within 24 hours
2. **Triage**: Our team evaluates severity and impact
3. **Investigation**: Engineers reproduce and diagnose
4. **Fix**: Issue is resolved and deployed
5. **Notification**: You're notified when fixed

### Feature Requests

1. **Review**: Product team reviews all requests
2. **Prioritization**: Features are scored on impact and feasibility
3. **Roadmap**: High-priority items are added to our roadmap
4. **Development**: Features are built and tested
5. **Release**: New features are announced in release notes

## Beta Feedback Program

As a beta user, your feedback carries extra weight:

### Beta-Specific Channels

- **Weekly Feedback Sessions**: Join our weekly call (Thursdays 2pm PT)
- **Slack Channel**: `#dmp-beta-feedback` (invitation sent via email)
- **Feature Voting**: Prioritize features at [feedback.code-reviewer.io](https://feedback.code-reviewer.io)

### Beta Feedback Rewards

Active beta participants receive:
- Extended free access
- Early feature previews
- Priority support
- Recognition in release notes

## Feature Request Guidelines

Help us understand your needs better:

### Good Feature Request

```markdown
**Feature**: Cross-repository blast radius analysis

**Problem**: When I modify shared modules, I can't see which
other repositories might be affected.

**Use Case**: We have 15 infrastructure repositories that share
common Terraform modules. Before deploying changes, I need to
understand the full blast radius across all repos.

**Proposed Solution**: Add an option to compute blast radius
across all repositories in a rollup, not just the current scan.

**Priority**: High - affects our deployment confidence
```

### Information to Include

1. **Clear title**: Summarize the feature in one line
2. **Problem statement**: What problem does this solve?
3. **Use case**: Describe your specific scenario
4. **Proposed solution**: Your idea (optional but helpful)
5. **Priority**: How important is this to your workflow?

## Bug Report Guidelines

### Effective Bug Report

```markdown
**Summary**: Graph fails to load for scans with >2000 nodes

**Steps to Reproduce**:
1. Add repository "my-org/large-infrastructure"
2. Trigger a scan on main branch
3. Wait for scan to complete
4. Click "View Graph"

**Expected**: Graph loads with all nodes visible
**Actual**: Spinner shows indefinitely, console shows timeout error

**Environment**:
- Browser: Chrome 121.0.6167.85
- OS: macOS 14.3
- Scan ID: scan_abc123

**Screenshots**: [attached]
```

### Required Information

1. **Summary**: One-line description
2. **Steps to reproduce**: Exact steps to trigger the bug
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Environment**: Browser, OS, versions
6. **Identifiers**: Scan IDs, repository names

## Feature Voting

Vote on features at [feedback.code-reviewer.io](https://feedback.code-reviewer.io):

1. Browse existing feature requests
2. Vote for features you want
3. Add comments with your use cases
4. Track progress on accepted features

### Top Requested Features

| Feature | Votes | Status |
|---------|-------|--------|
| Cross-repo blast radius | 142 | In Development |
| Terraform Cloud integration | 98 | Planned Q2 |
| Custom node colors | 76 | Under Review |
| Offline graph export | 65 | Under Review |
| Multi-select node actions | 52 | Backlog |

## Contact Us

| Channel | Use For | Response Time |
|---------|---------|---------------|
| In-app feedback | Quick thoughts, bugs | 24-48 hours |
| feedback@code-reviewer.io | Detailed feedback | 24-48 hours |
| Support tickets | Account issues | 4-24 hours |
| Slack (beta only) | Discussions, questions | Same day |

## Thank You

Every piece of feedback helps us build a better product. We read every submission and use it to guide our development priorities.

Special thanks to our active beta testers whose feedback has shaped DMP into what it is today.
