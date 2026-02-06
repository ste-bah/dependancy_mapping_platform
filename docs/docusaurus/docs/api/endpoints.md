---
id: endpoints
title: API Endpoints
sidebar_position: 2
description: Complete reference for all DMP API endpoints
---

# API Endpoints

This document provides a complete reference for all Dependency Mapping Platform API endpoints.

## Base URL

```
https://api.code-reviewer.io/api/v1
```

All endpoints require authentication. See [Authentication](/api/authentication) for details.

## Repositories

### List Repositories

<span class="api-method api-method--get">GET</span> `/repositories`

Returns a paginated list of repositories for the current tenant.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page (max 100) |
| `provider` | string | - | Filter by provider (github, gitlab, bitbucket) |
| `search` | string | - | Search by repository name |
| `isActive` | boolean | - | Filter by active status |

**Response:**

```json
{
  "data": [
    {
      "id": "repo_abc123",
      "provider": "github",
      "owner": "my-org",
      "name": "infrastructure",
      "defaultBranch": "main",
      "isActive": true,
      "lastScanAt": "2026-02-05T10:30:00Z",
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Create Repository

<span class="api-method api-method--post">POST</span> `/repositories`

Add a new repository for tracking.

**Request Body:**

```json
{
  "provider": "github",
  "owner": "my-org",
  "name": "infrastructure",
  "defaultBranch": "main",
  "webhookEnabled": true
}
```

**Response:** `201 Created`

```json
{
  "id": "repo_abc123",
  "provider": "github",
  "owner": "my-org",
  "name": "infrastructure",
  "defaultBranch": "main",
  "isActive": true,
  "webhookSecret": "whsec_...",
  "createdAt": "2026-02-05T10:30:00Z"
}
```

### Get Repository

<span class="api-method api-method--get">GET</span> `/repositories/{repositoryId}`

Get a single repository by ID.

### Update Repository

<span class="api-method api-method--put">PUT</span> `/repositories/{repositoryId}`

Update repository settings.

**Request Body:**

```json
{
  "defaultBranch": "main",
  "isActive": true,
  "scanConfig": {
    "includePatterns": ["**/*.tf", "**/*.hcl"],
    "excludePatterns": ["**/node_modules/**"]
  }
}
```

### Delete Repository

<span class="api-method api-method--delete">DELETE</span> `/repositories/{repositoryId}`

Remove a repository from tracking. This does not delete scan history.

## Scans

### List Scans

<span class="api-method api-method--get">GET</span> `/scans`

Returns a paginated list of scans.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `repositoryId` | string | Filter by repository |
| `status` | string | Filter by status (pending, completed, failed) |
| `branch` | string | Filter by branch |
| `startDate` | string | Filter scans after this date (ISO 8601) |
| `endDate` | string | Filter scans before this date (ISO 8601) |

### Create Scan

<span class="api-method api-method--post">POST</span> `/scans`

Trigger a new scan for a repository.

**Request Body:**

```json
{
  "repositoryId": "repo_abc123",
  "branch": "main",
  "commitSha": "abc123def456"
}
```

**Response:** `202 Accepted`

```json
{
  "id": "scan_xyz789",
  "repositoryId": "repo_abc123",
  "status": "pending",
  "branch": "main",
  "commitSha": "abc123def456",
  "createdAt": "2026-02-05T10:30:00Z"
}
```

### Get Scan

<span class="api-method api-method--get">GET</span> `/scans/{scanId}`

Get scan details including results if completed.

**Response:**

```json
{
  "id": "scan_xyz789",
  "repositoryId": "repo_abc123",
  "status": "completed",
  "branch": "main",
  "commitSha": "abc123def456",
  "nodeCount": 150,
  "edgeCount": 280,
  "startedAt": "2026-02-05T10:30:00Z",
  "completedAt": "2026-02-05T10:31:15Z",
  "metrics": {
    "parseTimeMs": 5200,
    "indexTimeMs": 1800
  }
}
```

### Get Scan Status

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/status`

Get real-time scan status for polling.

**Response:**

```json
{
  "status": "analyzing",
  "progress": 65,
  "currentStep": "Parsing Terraform files",
  "estimatedCompletionTime": "2026-02-05T10:31:00Z"
}
```

### Cancel Scan

<span class="api-method api-method--delete">DELETE</span> `/scans/{scanId}`

Cancel a pending or in-progress scan.

## Graph

All graph endpoints are scoped to a specific scan.

### Get Full Graph

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/graph`

Get the complete dependency graph for a scan.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxDepth` | integer | Maximum traversal depth |
| `nodeTypes` | string | Comma-separated node types to include |
| `search` | string | Filter nodes by name |

**Response:**

```json
{
  "nodes": [
    {
      "id": "node_001",
      "name": "aws_vpc.main",
      "type": "terraform_resource",
      "location": {
        "filePath": "network/vpc.tf",
        "startLine": 1,
        "endLine": 15
      },
      "metadata": {
        "provider": "aws",
        "resourceType": "aws_vpc"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_001",
      "sourceNodeId": "node_002",
      "targetNodeId": "node_001",
      "type": "DEPENDS_ON",
      "confidence": 1.0
    }
  ],
  "metadata": {
    "scanId": "scan_xyz789",
    "nodeCount": 150,
    "edgeCount": 280
  }
}
```

### List Nodes

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/nodes`

Get a paginated list of nodes with filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by node type |
| `search` | string | Search by name (fuzzy matching) |
| `filePath` | string | Filter by file path |
| `page` | integer | Page number |
| `pageSize` | integer | Items per page |

### Get Node Details

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/nodes/{nodeId}`

Get detailed information about a specific node.

**Response:**

```json
{
  "id": "node_001",
  "name": "aws_vpc.main",
  "type": "terraform_resource",
  "location": {
    "filePath": "network/vpc.tf",
    "startLine": 1,
    "endLine": 15
  },
  "metadata": {
    "provider": "aws",
    "resourceType": "aws_vpc",
    "attributes": {
      "cidr_block": "10.0.0.0/16",
      "enable_dns_support": true
    }
  },
  "dependencies": [
    {
      "id": "node_010",
      "name": "data.aws_availability_zones.available",
      "type": "terraform_data_source"
    }
  ],
  "dependents": [
    {
      "id": "node_002",
      "name": "aws_subnet.public",
      "type": "terraform_resource"
    }
  ]
}
```

### Get Node Dependencies

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/nodes/{nodeId}/dependencies`

Get all resources that this node depends on (downstream).

### Get Node Dependents

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/nodes/{nodeId}/dependents`

Get all resources that depend on this node (upstream).

### Get Blast Radius

<span class="api-method api-method--get">GET</span> `/scans/{scanId}/nodes/{nodeId}/blast-radius`

Calculate the blast radius for a node.

**Response:**

```json
{
  "nodeId": "node_001",
  "directDependents": 5,
  "transitiveDependents": 12,
  "impactScore": 0.65,
  "severity": "high",
  "affectedNodes": [
    {
      "id": "node_002",
      "name": "aws_subnet.public",
      "type": "terraform_resource",
      "isDirect": true,
      "depth": 1
    }
  ]
}
```

### Impact Analysis

<span class="api-method api-method--post">POST</span> `/scans/{scanId}/impact`

Analyze impact of changes to multiple files.

**Request Body:**

```json
{
  "filePaths": [
    "network/vpc.tf",
    "network/subnets.tf"
  ]
}
```

**Response:**

```json
{
  "totalAffectedNodes": 25,
  "maxImpactScore": 0.72,
  "files": [
    {
      "filePath": "network/vpc.tf",
      "nodes": 3,
      "impactScore": 0.72
    }
  ],
  "affectedNodes": [...]
}
```

## Webhooks

### GitHub Webhook

<span class="api-method api-method--post">POST</span> `/webhooks/github`

Receive GitHub push events. Used by GitHub webhook configuration.

### GitLab Webhook

<span class="api-method api-method--post">POST</span> `/webhooks/gitlab`

Receive GitLab push events. Used by GitLab webhook configuration.

## Error Responses

All endpoints may return the following error responses:

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 401 | `AUTH_REQUIRED` | Authentication required |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

See [Error Handling](/api/error-handling) for details.

## Next Steps

- [Authentication](/api/authentication) - Set up API access
- [Rate Limits](/api/rate-limits) - Understand rate limiting
- [Error Handling](/api/error-handling) - Handle errors gracefully
