# DMP Documentation Site

This directory contains the Docusaurus-based documentation site for the Dependency Mapping Platform.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd docs/docusaurus
npm install
```

### Development

Start the development server:

```bash
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

The documentation is automatically deployed via CI/CD when changes are pushed to the main branch.

## Project Structure

```
docusaurus/
  docs/                   # Main documentation
    getting-started.md    # Quick start guide
    repositories/         # Repository management
    graphs/               # Graph visualization
    api/                  # API reference
    integrations/         # CI/CD integrations
    support/              # Help & troubleshooting
  api-docs/               # API reference docs
  src/
    css/
      custom.css          # Custom styling
  docusaurus.config.js    # Docusaurus configuration
  sidebars.js             # Main sidebar configuration
  sidebarsApi.js          # API sidebar configuration
  package.json            # Dependencies
```

## Writing Documentation

### Front Matter

Every markdown file should include front matter:

```yaml
---
id: unique-id
title: Page Title
sidebar_position: 1
description: Brief description for SEO
---
```

### Admonitions

Use admonitions for callouts:

```markdown
:::note
This is a note
:::

:::tip
This is a tip
:::

:::info
This is info
:::

:::warning
This is a warning
:::

:::danger
This is danger
:::
```

### Code Blocks

Use language-specific code blocks:

```markdown
```bash
npm install
```

```typescript
const x: number = 1;
```

```hcl
resource "aws_instance" "example" {
  ami = "ami-12345"
}
```
```

### Internal Links

Link to other docs using relative paths:

```markdown
See [Getting Started](/getting-started)
```

## Contributing

1. Create a branch for your changes
2. Make edits in the `docs/` directory
3. Test locally with `npm start`
4. Submit a pull request

## Deployment

Documentation is deployed to https://docs.code-reviewer.io

Deployments happen automatically on merge to main.
