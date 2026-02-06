---
id: blast-radius
title: Blast Radius Analysis
sidebar_position: 4
description: Understanding and using blast radius analysis for infrastructure changes
---

# Blast Radius Analysis

Blast radius analysis helps you understand the potential impact of changing a specific infrastructure resource. Before making changes, you can visualize which other resources might be affected.

## What is Blast Radius?

The **blast radius** of a resource is the set of all resources that could be affected if that resource changes. This includes:

- **Direct dependents**: Resources that directly depend on the selected resource
- **Transitive dependents**: Resources affected through dependency chains

## Why Use Blast Radius?

Understanding blast radius helps you:

1. **Plan changes safely**: Know what might break before you make changes
2. **Scope testing**: Identify which resources need testing after a change
3. **Risk assessment**: Quantify the risk of infrastructure modifications
4. **Change review**: Provide context for pull request reviews

## Using Blast Radius

### Activate Blast Radius View

1. Select a node in the dependency graph
2. Click the **"Blast Radius"** button in the toolbar, or
3. Press `B` on your keyboard, or
4. Toggle **"Show Blast Radius"** in the filter panel

### Visual Indicators

When blast radius is active:

| Indicator | Meaning |
|-----------|---------|
| **Red border** | Selected node (origin of blast radius) |
| **Orange highlight** | Direct dependents (1 hop away) |
| **Yellow highlight** | Transitive dependents (2+ hops away) |
| **Dimmed** | Unaffected resources |
| **Animated edges** | Dependency paths |

## Impact Score

Each resource has a calculated **impact score** (0-1) based on:

```
Impact Score = (Direct Dependents * 2 + Transitive Dependents) / Total Nodes * Criticality Factor
```

### Severity Levels

| Score Range | Severity | Meaning |
|-------------|----------|---------|
| 0.80 - 1.00 | Critical | Core infrastructure, many dependents |
| 0.60 - 0.79 | High | Significant impact, careful planning needed |
| 0.40 - 0.59 | Medium | Moderate impact, standard review |
| 0.20 - 0.39 | Low | Limited impact, routine change |
| 0.00 - 0.19 | Minimal | Very few dependents |

## Blast Radius Details

The detail panel shows blast radius information:

### Summary

```
Blast Radius Analysis
---------------------
Direct Dependents:    5
Transitive Dependents: 12
Total Affected:       17
Impact Score:         0.65 (High)
```

### Affected Resources List

Organized by depth from the selected node:

```
Depth 1 (Direct):
  - aws_security_group.web
  - aws_instance.app[0]
  - aws_instance.app[1]
  - aws_lb_target_group.app
  - aws_route53_record.app

Depth 2:
  - aws_lb.app
  - aws_cloudwatch_alarm.cpu

Depth 3:
  - aws_route53_record.lb
```

## API Access

Retrieve blast radius programmatically:

```bash
# Get blast radius for a specific node
curl -X GET \
  "https://api.code-reviewer.io/api/v1/scans/{scanId}/graph/nodes/{nodeId}/blast-radius" \
  -H "Authorization: Bearer {token}"
```

Response:

```json
{
  "nodeId": "aws_vpc.main",
  "directDependents": 5,
  "transitiveDependents": 12,
  "impactScore": 0.65,
  "severity": "high",
  "affectedNodes": [
    {
      "id": "aws_subnet.public",
      "name": "aws_subnet.public",
      "type": "terraform_resource",
      "isDirect": true,
      "depth": 1
    },
    // ... more nodes
  ]
}
```

## Cross-Repository Blast Radius

For organizations using multiple repositories, DMP can calculate blast radius across repositories using Rollups:

### Enable Cross-Repo Analysis

1. Create a Rollup configuration that includes relevant repositories
2. Execute the rollup to aggregate dependencies
3. Use the rollup graph for blast radius analysis

### External Dependencies

When a resource references external systems (AWS services, external APIs), DMP tracks these as **external objects**:

```
Blast Radius for: aws_iam_role.app
----------------------------------
Direct Dependents: 3
Transitive Dependents: 8
External References:
  - AWS IAM (arn:aws:iam::123456789:policy/AdminAccess)
  - AWS KMS (arn:aws:kms:us-east-1:123456789:key/xxx)
```

## Best Practices

### Before Making Changes

1. **Always check blast radius** for critical infrastructure
2. **Review high-impact changes** with team members
3. **Plan rollback procedures** for high-severity changes

### In CI/CD Pipelines

Integrate blast radius checks:

```yaml
# .github/workflows/terraform.yml
- name: Check Blast Radius
  run: |
    BLAST=$(curl -s -X GET "$DMP_API/scans/$SCAN_ID/graph/nodes/$NODE_ID/blast-radius" \
      -H "Authorization: Bearer $DMP_TOKEN")
    IMPACT=$(echo $BLAST | jq -r '.impactScore')
    if (( $(echo "$IMPACT > 0.8" | bc -l) )); then
      echo "::warning::High impact change detected (score: $IMPACT)"
    fi
```

### Documentation

Include blast radius in change documentation:

```markdown
## Change Impact Analysis

**Modified Resource**: aws_vpc.main
**Impact Score**: 0.72 (High)
**Affected Resources**: 17

This change will affect the following critical resources:
- Application load balancer
- All EC2 instances in the VPC
- RDS database subnets
```

## Troubleshooting

### Blast Radius Shows Zero

- Ensure the scan completed successfully
- Check if the node has any dependents
- Verify the node is not isolated

### Unexpected Dependencies

- Review edge confidence scores
- Check for implicit dependencies in your code
- Verify Terraform state is up to date

### Performance Issues

For very large blast radii (>100 nodes):

- Use filters to focus on specific resource types
- Consider breaking up large modules
- Export data for offline analysis

## Next Steps

- [Graph Diff](/graphs/graph-diff) - Compare dependencies between scans
- [Cross-Repo Analysis](/advanced/cross-repo-analysis) - Aggregate multiple repositories
- [CI/CD Integration](/integrations/github-actions) - Automate blast radius checks
