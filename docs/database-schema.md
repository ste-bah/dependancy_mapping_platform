# Database Schema Documentation

## Overview

The Dependency Mapping Platform uses PostgreSQL 16 with specialized extensions for full-text search (pg_search), fuzzy matching (pg_trgm), and time-series optimization (TimescaleDB).

## Entity Relationship Diagram

```
┌─────────────────┐
│     tenants     │
├─────────────────┤
│ id (PK)         │
│ name            │
│ slug (UNIQUE)   │
│ settings        │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐         ┌──────────────────────┐
│  repositories   │         │   external_objects   │
├─────────────────┤         ├──────────────────────┤
│ id (PK)         │         │ id (PK)              │
│ tenant_id (FK)  │◄────────│ tenant_id (FK)       │
│ provider        │         │ type                 │
│ owner           │         │ identifier (UNIQUE)  │
│ name            │         │ provider             │
│ default_branch  │         │ first_seen_scan_id   │
│ clone_url       │         │ reference_count      │
│ last_scan_at    │         │ metadata             │
│ metadata        │         │ created_at           │
│ created_at      │         │ updated_at           │
│ updated_at      │         └──────────────────────┘
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│     scans       │ ◄── TimescaleDB Hypertable
├─────────────────┤
│ id (PK)         │
│ repository_id   │
│ commit_sha      │
│ branch          │
│ status          │
│ started_at      │ ◄── Partition key
│ completed_at    │
│ node_count      │
│ edge_count      │
│ error_message   │
│ scan_config     │
│ metrics         │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│     nodes       │ ◄── BM25 + Trigram indexes
├─────────────────┤
│ id (PK)         │
│ scan_id (FK)    │
│ type            │
│ name            │
│ qualified_name  │
│ file_path       │
│ line_start      │
│ line_end        │
│ content_hash    │
│ metadata        │
│ search_vector   │ ◄── Full-text search
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ N:M (via edges)
         ▼
┌─────────────────┐
│     edges       │
├─────────────────┤
│ id (PK)         │
│ scan_id (FK)    │
│ source_node_id  │
│ target_node_id  │
│ type            │
│ confidence      │
│ evidence        │
│ created_at      │
└─────────────────┘
```

## Tables

### tenants
Multi-tenancy isolation table for organizations/workspaces.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Display name |
| slug | VARCHAR(100) | URL-safe unique identifier |
| settings | JSONB | Tenant configuration |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### repositories
Git repositories tracked for dependency analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Foreign key to tenants |
| provider | ENUM | github, gitlab, bitbucket, azure_devops |
| owner | VARCHAR(255) | Repository owner/org |
| name | VARCHAR(255) | Repository name |
| default_branch | VARCHAR(255) | Default branch (main/master) |
| clone_url | TEXT | Git clone URL |
| webhook_secret | TEXT | Webhook verification secret |
| last_scan_at | TIMESTAMPTZ | Last successful scan time |
| is_active | BOOLEAN | Active tracking flag |
| metadata | JSONB | Additional repository metadata |

### scans
Repository scan executions (TimescaleDB hypertable).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| repository_id | UUID | Foreign key to repositories |
| commit_sha | VARCHAR(40) | Git commit SHA |
| branch | VARCHAR(255) | Branch being scanned |
| status | ENUM | pending, cloning, analyzing, indexing, completed, failed, cancelled |
| started_at | TIMESTAMPTZ | Scan start time (partition key) |
| completed_at | TIMESTAMPTZ | Scan completion time |
| node_count | INTEGER | Count of nodes discovered |
| edge_count | INTEGER | Count of edges discovered |
| error_message | TEXT | Error details if failed |
| scan_config | JSONB | Scan configuration |
| metrics | JSONB | Performance metrics |

### nodes
Dependency graph vertices (resources, modules, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scan_id | UUID | Foreign key to scans |
| type | ENUM | Node type (tf_resource, helm_chart, etc.) |
| name | VARCHAR(500) | Resource name |
| qualified_name | VARCHAR(1000) | Fully qualified name |
| file_path | VARCHAR(1000) | Source file path |
| line_start | INTEGER | Starting line number |
| line_end | INTEGER | Ending line number |
| content_hash | VARCHAR(64) | Content hash for change detection |
| metadata | JSONB | Additional node metadata |
| search_vector | TSVECTOR | Full-text search vector |

### edges
Dependency relationships between nodes.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scan_id | UUID | Foreign key to scans |
| source_node_id | UUID | Foreign key to source node |
| target_node_id | UUID | Foreign key to target node |
| type | ENUM | depends_on, references, imports, etc. |
| confidence | DECIMAL(3,2) | Confidence score (0.00-1.00) |
| evidence | JSONB | Supporting evidence |

### external_objects
Cross-repository external references.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Foreign key to tenants |
| type | VARCHAR(100) | External object type |
| identifier | VARCHAR(500) | Unique identifier |
| provider | VARCHAR(100) | Provider name |
| first_seen_scan_id | UUID | First scan that discovered this |
| reference_count | INTEGER | Number of references |
| metadata | JSONB | Additional metadata |

## Enums

### git_provider
- `github`
- `gitlab`
- `bitbucket`
- `azure_devops`

### scan_status
- `pending` - Queued for processing
- `cloning` - Cloning repository
- `analyzing` - Running analysis
- `indexing` - Building indexes
- `completed` - Successfully completed
- `failed` - Failed with error
- `cancelled` - Cancelled by user

### node_type
**Terraform:**
- `tf_resource`, `tf_data_source`, `tf_module`, `tf_variable`, `tf_output`, `tf_provider`, `tf_local`

**Helm:**
- `helm_chart`, `helm_template`, `helm_values`, `helm_dependency`

**Terragrunt:**
- `tg_module`, `tg_dependency`, `tg_include`

**Generic:**
- `file`, `external_reference`

### edge_type
- `depends_on` - Explicit dependency
- `references` - Variable/output reference
- `imports` - Module import
- `provides` - Provider dependency
- `inherits` - Terragrunt inheritance
- `overrides` - Value override
- `calls` - Function/module call
- `contains` - Parent-child containment

## Indexes

### Search Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| nodes | idx_nodes_name_bm25 | BM25 | Relevance-ranked full-text search |
| nodes | idx_nodes_name_trgm | GIN (trigram) | Fuzzy name matching |
| nodes | idx_nodes_file_path_trgm | GIN (trigram) | Fuzzy file path search |
| nodes | idx_nodes_search_vector | GIN (tsvector) | PostgreSQL native full-text |

### Performance Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| scans | idx_scans_repository | repository_id | Filter by repository |
| scans | idx_scans_started_at | started_at DESC | Time-range queries |
| nodes | idx_nodes_scan_type | scan_id, type | Filter nodes by scan and type |
| edges | idx_edges_scan_source | scan_id, source_node_id | Graph traversal |
| edges | idx_edges_scan_target | scan_id, target_node_id | Reverse graph traversal |

## TimescaleDB Features

### Hypertable
The `scans` table is converted to a TimescaleDB hypertable partitioned by `started_at` with 7-day chunks.

### Compression
Chunks older than 30 days are automatically compressed using:
- Segment by: `repository_id`
- Order by: `started_at DESC`

### Continuous Aggregates
- `scan_stats_daily` - Daily scan statistics per repository
- `scan_stats_hourly` - Hourly scan statistics for recent activity

## Search Functions

### Fuzzy Search
```sql
SELECT * FROM search_nodes(
    p_scan_id := 'uuid-here',
    p_query := 'aws_instance',
    p_limit := 50,
    p_min_similarity := 0.3
);
```

### Full-Text Search
```sql
SELECT * FROM fulltext_search_nodes(
    p_scan_id := 'uuid-here',
    p_query := 'database connection',
    p_limit := 50
);
```

### Scan History
```sql
SELECT * FROM get_scan_history(
    p_repository_id := 'uuid-here',
    p_start_time := NOW() - INTERVAL '30 days'
);
```

## Migration Files

1. `001_initial_schema.sql` - Core tables, enums, triggers
2. `002_search_indexes.sql` - BM25, trigram, full-text indexes
3. `003_timescaledb_setup.sql` - Hypertable, compression, aggregates
