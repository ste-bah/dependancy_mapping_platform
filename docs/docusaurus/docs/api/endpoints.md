---
id: endpoints
title: API Endpoints
sidebar_position: 2
description: Complete reference for all DMP API endpoints
---

# API Endpoints

This document provides a reference for the currently implemented Dependency Mapping Platform API endpoints.

## Base URL

```text
https://api.code-reviewer.io/api/v1
```

Most endpoints require authentication. See [Authentication](/api/authentication) for details.

## Repositories

### GET /repositories

Returns repositories accessible to the authenticated user through the configured Git provider integration.

### GET /repositories/{owner}/{name}

Get repository details from the connected provider.

### POST /repositories/{owner}/{name}/clone

Clone a repository archive into platform storage.

### POST /repositories/{owner}/{name}/webhook

Register a provider webhook for repository events.

## Scans

### GET /scans

Returns a paginated list of scans for the current tenant.

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `repositoryId` | string | Filter by repository UUID |
| `status` | string | Filter by scan status |
| `since` | string | Filter by start date (ISO 8601) |
| `until` | string | Filter by end date (ISO 8601) |
| `page` | integer | Page number |
| `pageSize` | integer | Items per page |

### POST /scans

Create a persisted scan record for a repository.

Request body:

```json
{
  "repositoryId": "00000000-0000-0000-0000-000000000001",
  "ref": "main",
  "config": {
    "detectTypes": ["terraform", "kubernetes", "helm"],
    "includeImplicit": true,
    "minConfidence": 40,
    "maxDepth": 10
  }
}
```

Response:

```json
{
  "id": "00000000-0000-0000-0000-000000000010",
  "repositoryId": "00000000-0000-0000-0000-000000000001",
  "status": "pending",
  "ref": "main",
  "commitSha": "0000000000000000000000000000000000000000",
  "config": {
    "detectTypes": ["terraform", "kubernetes", "helm"],
    "includeImplicit": true,
    "minConfidence": 40,
    "maxDepth": 10
  },
  "progress": {
    "phase": "initializing",
    "percentage": 0,
    "filesProcessed": 0,
    "totalFiles": 0,
    "nodesDetected": 0,
    "edgesDetected": 0,
    "errors": 0,
    "warnings": 0
  },
  "createdAt": "2026-04-17T12:00:00.000Z",
  "updatedAt": "2026-04-17T12:00:00.000Z"
}
```

### GET /scans/{scanId}

Get the full persisted scan record.

### GET /scans/{scanId}/status

Get a lightweight status payload for polling.

```json
{
  "id": "00000000-0000-0000-0000-000000000010",
  "status": "running",
  "progress": {
    "phase": "parsing",
    "percentage": 42,
    "filesProcessed": 21,
    "totalFiles": 50,
    "nodesDetected": 120,
    "edgesDetected": 185,
    "errors": 0,
    "warnings": 2
  },
  "startedAt": "2026-04-17T12:00:05.000Z",
  "estimatedTimeRemaining": 18
}
```

### DELETE /scans/{scanId}

Cancel a pending, queued, or running scan.

```json
{
  "reason": "Cancelled by user"
}
```

## Graph

All graph endpoints are scoped to a specific scan.

### GET /scans/{scanId}/graph

Get the full persisted graph for a scan.

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeMetadata` | boolean | Include node and scan metadata |

```json
{
  "scanId": "00000000-0000-0000-0000-000000000010",
  "nodes": [
    {
      "id": "00000000-0000-0000-0000-000000000100",
      "type": "tf_resource",
      "name": "aws_vpc.main",
      "location": {
        "file": "network/vpc.tf",
        "lineStart": 1,
        "lineEnd": 15
      },
      "metadata": {
        "provider": "aws"
      }
    }
  ],
  "edges": [
    {
      "id": "00000000-0000-0000-0000-000000000200",
      "source": "00000000-0000-0000-0000-000000000101",
      "target": "00000000-0000-0000-0000-000000000100",
      "type": "references",
      "confidence": 95,
      "isImplicit": false
    }
  ],
  "stats": {
    "totalNodes": 150,
    "totalEdges": 280,
    "nodesByType": {
      "tf_resource": 120
    },
    "edgesByType": {
      "references": 180
    },
    "avgEdgesPerNode": 1.87,
    "density": 0.0125,
    "hasCycles": false
  },
  "metadata": {
    "ref": "main",
    "commitSha": "abc123def456",
    "generatedAt": "2026-04-17T12:10:00.000Z"
  }
}
```

### GET /scans/{scanId}/nodes

List nodes for a scan with pagination and filtering.

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by node type |
| `types` | string | Comma-separated node types |
| `search` | string | Search by name or file path |
| `filePath` | string | Filter by file path |
| `name` | string | Filter by name |
| `page` | integer | Page number |
| `pageSize` | integer | Items per page |

### GET /scans/{scanId}/nodes/{nodeId}

Get node details plus incoming and outgoing edges.

### GET /scans/{scanId}/nodes/{nodeId}/dependencies

Traverse downstream dependencies from a node.

### GET /scans/{scanId}/nodes/{nodeId}/dependents

Traverse upstream dependents towards a node.

### GET /scans/{scanId}/edges

List edges for a scan with pagination and filtering.

### GET /scans/{scanId}/cycles

Detect cycles in the persisted dependency graph.

### POST /scans/{scanId}/impact

Analyze the impact of changing one or more node IDs.

```json
{
  "nodeIds": [
    "00000000-0000-0000-0000-000000000100"
  ],
  "maxDepth": 10
}
```

## Error Responses

All endpoints may return the following error responses:

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 401 | `AUTH_REQUIRED` | Authentication required |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource state conflict |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

See [Error Handling](/api/error-handling) for details.

## Next Steps

- [Authentication](/api/authentication) - Set up API access
- [Rate Limits](/api/rate-limits) - Understand rate limiting
- [Error Handling](/api/error-handling) - Handle errors gracefully
