---
id: understanding-graphs
title: Understanding Graphs
sidebar_position: 1
description: A comprehensive guide to understanding dependency graphs in DMP
---

# Understanding Dependency Graphs

The dependency graph is the core visualization in the Dependency Mapping Platform. This guide explains how to read and interpret the graph.

## Graph Overview

The dependency graph represents your infrastructure as a network of connected resources:

- **Nodes**: Individual infrastructure resources (Terraform resources, modules, Helm charts, etc.)
- **Edges**: Relationships between resources (dependencies, references, imports)

## Node Types

DMP recognizes several types of infrastructure nodes:

| Node Type | Color | Description |
|-----------|-------|-------------|
| **Terraform Resource** | Purple | AWS, GCP, Azure resources defined in `.tf` files |
| **Terraform Module** | Red | Reusable Terraform modules |
| **Terraform Data Source** | Teal | Data sources that read external data |
| **Helm Chart** | Blue | Helm chart definitions |
| **K8s Resource** | Green | Kubernetes resources from Helm templates |
| **External Reference** | Yellow | References to external systems |
| **Terragrunt Config** | Violet | Terragrunt configuration files |

### Node Information

Each node displays:

- **Name**: The resource identifier
- **Type Badge**: Visual indicator of the resource type
- **Location**: Source file and line number

Click a node to view detailed information in the detail panel.

## Edge Types

Edges represent relationships between nodes:

| Edge Type | Style | Description |
|-----------|-------|-------------|
| **DEPENDS_ON** | Animated blue | Explicit dependency (`depends_on` in Terraform) |
| **REFERENCES** | Gray | Variable or output references |
| **CONTAINS** | Green | Parent-child containment |
| **IMPORTS** | Orange | Module imports |
| **tg_includes** | Violet | Terragrunt include relationships |
| **tg_depends_on** | Light violet (animated) | Terragrunt dependency blocks |
| **tg_passes_input** | Light violet (animated) | Terragrunt input passing |
| **tg_sources** | Dark violet | Terragrunt source references |

### Edge Confidence

Edges include a confidence score (0-100%) indicating how certain DMP is about the relationship:

- **90-100%**: Explicit dependency, highly reliable
- **70-89%**: Strong implicit dependency
- **50-69%**: Likely dependency based on naming or patterns
- **Below 50%**: Possible dependency, review recommended

## Reading the Graph

### Direction of Dependencies

Dependencies flow from **source** to **target**:

```
Resource A --depends_on--> Resource B
```

This means **Resource A depends on Resource B**. If Resource B changes, Resource A may be affected.

### Dependency Chains

Follow the edges to understand how changes propagate:

```
VPC --> Subnet --> Security Group --> EC2 Instance
```

A change to the VPC could affect all downstream resources.

### Cycles

Circular dependencies are highlighted in red. While Terraform handles some cycles, they often indicate design issues.

## Graph Layout

### Automatic Layout

DMP automatically arranges nodes using a force-directed layout that:

- Places related nodes close together
- Minimizes edge crossings
- Groups nodes by type when possible

### Manual Adjustment

You can manually reposition nodes:

1. Click and drag any node
2. Release to set the new position
3. Click **"Reset Layout"** to return to automatic positioning

## Using the Graph

### Pan and Zoom

- **Pan**: Click and drag on empty space
- **Zoom**: Use mouse scroll or the zoom controls
- **Fit to View**: Press `F` or click the fit button

### Selection

- **Single Select**: Click a node
- **Multi-Select**: Hold `Shift` and click multiple nodes
- **Clear Selection**: Click empty space or press `Escape`

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Fit graph to view |
| `R` | Reset layout |
| `Escape` | Clear selection |
| `B` | Toggle blast radius for selected node |
| `+` / `-` | Zoom in/out |
| Arrow keys | Pan the view |

## Detail Panel

When a node is selected, the detail panel shows:

### Node Details

- **Full qualified name**
- **Resource type**
- **Source file location** (clickable to open in GitHub)
- **Line numbers**

### Dependencies Tab

Lists all resources this node depends on (downstream):

```
This resource depends on:
  - aws_vpc.main
  - aws_subnet.primary
  - data.aws_ami.ubuntu
```

### Dependents Tab

Lists all resources that depend on this node (upstream):

```
Resources that depend on this:
  - aws_instance.web
  - aws_security_group.web
```

### Metadata Tab

Shows additional metadata specific to the resource type:

- **Terraform**: Provider, resource count, attributes
- **Helm**: Chart version, app version, dependencies
- **Terragrunt**: Source, inputs, include count

## Graph Statistics

The statistics panel (toggle with the chart icon) shows:

- Total nodes and edges
- Breakdown by resource type
- Average/max dependencies per node
- Number of isolated nodes (no connections)

## Performance Considerations

For large graphs (>1000 nodes):

- Consider using filters to focus on specific areas
- Enable "Show connected only" to hide isolated nodes
- Use search to find specific resources
- Consider using cross-repository rollups to analyze subsets

## Next Steps

- [Navigation Controls](/graphs/navigation-controls) - Detailed navigation guide
- [Filtering and Searching](/graphs/filtering-searching) - Find specific resources
- [Blast Radius Analysis](/graphs/blast-radius) - Understand change impact
