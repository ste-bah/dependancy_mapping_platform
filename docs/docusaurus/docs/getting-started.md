---
id: getting-started
title: Getting Started
sidebar_position: 1
description: Quick start guide for the Dependency Mapping Platform
---

# Getting Started

Welcome to the **Dependency Mapping Platform (DMP)**. This guide will help you get up and running in minutes.

## What is DMP?

The Dependency Mapping Platform is an enterprise-grade infrastructure-as-code analysis tool that:

- **Visualizes dependencies** between your Terraform, Terragrunt, Helm, and Kubernetes resources
- **Calculates blast radius** to understand the impact of infrastructure changes
- **Tracks changes over time** with graph diff capabilities
- **Integrates with CI/CD** to provide automated dependency analysis

## Quick Start

### Step 1: Sign Up and Connect

1. Visit [app.code-reviewer.io](https://app.code-reviewer.io) and sign in with your GitHub account
2. Authorize the application to access your repositories
3. You will be redirected to your dashboard

### Step 2: Add Your First Repository

1. Click **"Add Repository"** from the dashboard
2. Select a repository from the list of available repositories
3. Choose the branches you want to track (default: main/master)
4. Click **"Add"** to start tracking

### Step 3: Run Your First Scan

Once a repository is added:

1. Navigate to the repository detail page
2. Click **"Trigger Scan"** to start analyzing your infrastructure
3. Wait for the scan to complete (typically 30 seconds to a few minutes)
4. View the dependency graph by clicking **"View Graph"**

### Step 4: Explore the Graph

The dependency graph shows:

- **Nodes**: Your infrastructure resources (Terraform resources, modules, Helm charts, etc.)
- **Edges**: Dependencies between resources
- **Colors**: Different resource types are color-coded for easy identification

Try these actions:
- Click a node to see its details
- Use the filter panel to show specific resource types
- Click "Blast Radius" to see the impact of changing a resource

## Supported Infrastructure

DMP currently supports:

| Tool | Resource Types |
|------|---------------|
| **Terraform** | Resources, modules, data sources, variables, outputs |
| **Terragrunt** | Configurations, dependencies, includes |
| **Helm** | Charts, templates, values, dependencies |
| **Kubernetes** | All resource types via Helm templates |

## Key Features

### Dependency Visualization

View your entire infrastructure as an interactive graph. Understand how resources connect and depend on each other.

### Blast Radius Analysis

Before making changes, understand what could be affected. Select any resource to see its blast radius, which shows:

- **Direct dependents**: Resources that directly depend on the selected resource
- **Transitive dependents**: Resources affected through dependency chains
- **Impact score**: A calculated metric based on the number and criticality of affected resources

### Cross-Repository Analysis

For organizations with multiple repositories, DMP can aggregate dependencies across repositories using Rollups, providing a unified view of your infrastructure.

### CI/CD Integration

Integrate DMP into your CI/CD pipelines to:

- Automatically scan on every push
- Block merges if critical dependencies are broken
- Generate reports on infrastructure changes

## Next Steps

- [Adding Repositories](/repositories/adding-repositories) - Detailed guide on repository management
- [Understanding Graphs](/graphs/understanding-graphs) - Deep dive into graph visualization
- [Blast Radius Analysis](/graphs/blast-radius) - Learn about impact analysis
- [API Reference](/api) - Programmatic access to DMP

## Need Help?

- Check our [FAQ](/support/faq) for common questions
- Review the [Troubleshooting Guide](/support/troubleshooting) for solutions
- Contact support at support@code-reviewer.io
