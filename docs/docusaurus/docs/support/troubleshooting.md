---
id: troubleshooting
title: Troubleshooting Guide
sidebar_position: 1
description: Solutions for common issues with the Dependency Mapping Platform
---

# Troubleshooting Guide

This guide provides solutions for common issues you may encounter with the Dependency Mapping Platform.

## Authentication Issues

### Cannot Sign In with GitHub

**Symptoms**: OAuth flow fails, error message about authentication

**Solutions**:

1. **Clear browser cookies**
   - Clear cookies for `code-reviewer.io` and `github.com`
   - Try signing in again

2. **Check GitHub account status**
   - Ensure your GitHub account is in good standing
   - Verify you can log into GitHub directly

3. **Organization restrictions**
   - If using an organization repository, check if third-party apps are restricted
   - Ask an organization admin to approve the DMP OAuth app

4. **Browser issues**
   - Disable browser extensions that might block OAuth
   - Try a different browser or incognito mode

### API Key Not Working

**Symptoms**: `401 Unauthorized` errors when using API key

**Solutions**:

1. **Verify key format**
   ```bash
   # Key should start with dmp_key_
   echo $DMP_API_KEY | head -c 10
   # Should output: dmp_key_xx
   ```

2. **Check expiration**
   - API keys have expiration dates
   - Create a new key if expired

3. **Verify scopes**
   - Ensure key has required scopes for the operation
   - Check Settings > API Keys for scope list

4. **Confirm header format**
   ```bash
   # Correct
   curl -H "Authorization: Bearer dmp_key_xxx..."
   # Also valid
   curl -H "X-API-Key: dmp_key_xxx..."
   ```

### Token Expired Errors

**Symptoms**: Sudden `AUTH_TOKEN_EXPIRED` errors after working

**Solutions**:

1. **Refresh the page** - Web app will automatically refresh tokens
2. **Re-authenticate** - Sign out and sign back in
3. **For API usage** - Use the refresh token endpoint:
   ```bash
   curl -X POST https://api.code-reviewer.io/auth/refresh \
     -d '{"refresh_token": "..."}'
   ```

## Repository Issues

### Repository Not Appearing in List

**Symptoms**: Known repositories don't show in "Add Repository" modal

**Solutions**:

1. **Refresh repository list**
   - Click the refresh button in the modal
   - This re-syncs with your Git provider

2. **Check OAuth permissions**
   - Go to GitHub > Settings > Applications
   - Find DMP and check repository access
   - Grant access to missing repositories

3. **Organization repositories**
   - Organization admin must grant OAuth app access
   - Check organization settings for third-party access

4. **Private repositories**
   - Ensure OAuth app has `repo` scope
   - Re-authenticate if needed

### Repository Shows "Error" Status

**Symptoms**: Repository card shows error indicator

**Solutions**:

1. **Check connection**
   - Go to repository detail page
   - Look for specific error message

2. **Verify access**
   - Ensure you still have access to the repository
   - Check if repository was transferred or deleted

3. **Re-add repository**
   - Remove the repository from DMP
   - Add it again to re-establish connection

## Scan Issues

### Scan Stuck in "Pending" State

**Symptoms**: Scan shows "pending" for more than 5 minutes

**Solutions**:

1. **Check queue status**
   - High demand may cause delays
   - Check status page for incidents

2. **Cancel and retry**
   - Cancel the stuck scan
   - Trigger a new scan

3. **Repository size**
   - Very large repositories take longer
   - Consider adding file exclusion patterns

### Scan Failed

**Symptoms**: Scan status shows "failed"

**Solutions**:

1. **Check error message**
   - Go to scan detail page
   - Read the specific error message

2. **Common causes**:
   - **Clone failed**: Repository access issue
   - **Parse error**: Invalid Terraform/HCL syntax
   - **Timeout**: Repository too large

3. **For syntax errors**
   - Run `terraform validate` locally
   - Fix syntax issues and trigger new scan

4. **For timeout**
   - Add exclusion patterns for unnecessary files
   - Contact support for large repository assistance

### Missing Resources in Graph

**Symptoms**: Expected resources don't appear in graph

**Solutions**:

1. **Check file patterns**
   - Review include/exclude patterns in repository settings
   - Ensure file extensions match (`.tf`, `.hcl`)

2. **Verify scan completion**
   - Check scan completed successfully
   - Look at node count in scan details

3. **Filter settings**
   - Check active filters in the graph view
   - Reset filters to see all nodes

4. **Resource type support**
   - Verify resource type is supported
   - Check documentation for supported types

## Graph Issues

### Graph Not Loading

**Symptoms**: Graph view shows loading spinner indefinitely

**Solutions**:

1. **Check network**
   - Verify internet connection
   - Check for firewall blocking API

2. **Browser issues**
   - Clear browser cache
   - Disable extensions
   - Try different browser

3. **Large graph**
   - Graphs with >5000 nodes may be slow
   - Use filters to reduce visible nodes

### Graph Performance Slow

**Symptoms**: Graph is laggy, slow to respond

**Solutions**:

1. **Reduce visible nodes**
   - Apply type filters
   - Use search to focus on specific areas
   - Enable "Show connected only"

2. **Browser performance**
   - Close other tabs
   - Update browser to latest version
   - Try Chrome for best WebGL performance

3. **Disable animations**
   - Turn off edge animations in settings

### Blast Radius Not Calculating

**Symptoms**: Click "Blast Radius" but nothing happens

**Solutions**:

1. **Select a node first**
   - Blast radius requires a selected node
   - Click on a node, then click "Blast Radius"

2. **Node has no dependents**
   - Isolated nodes have no blast radius
   - Check if node has any edges

3. **API error**
   - Check browser console for errors
   - Try refreshing the page

## Webhook Issues

### Webhooks Not Triggering Scans

**Symptoms**: Push to repository doesn't start automatic scan

**Solutions**:

1. **Verify webhook is configured**
   - Check repository settings in DMP
   - Ensure webhook URL is registered

2. **Check webhook delivery**
   - In GitHub: Settings > Webhooks > Recent deliveries
   - Look for failed deliveries and error messages

3. **Secret mismatch**
   - Regenerate webhook secret in DMP
   - Update in Git provider settings

4. **Branch filtering**
   - Check if push branch is tracked
   - Add branch to tracking configuration

### Webhook Secret Invalid

**Symptoms**: Webhook deliveries fail with signature error

**Solutions**:

1. **Regenerate secret**
   - Go to repository settings in DMP
   - Click "Regenerate Webhook Secret"
   - Copy new secret

2. **Update Git provider**
   - Go to repository webhook settings
   - Update the secret field
   - Test with a push

## Performance Issues

### Slow API Responses

**Symptoms**: API calls take more than 5 seconds

**Solutions**:

1. **Check query parameters**
   - Large page sizes slow responses
   - Use pagination with reasonable limits

2. **Network issues**
   - Check your internet connection
   - Try from different network

3. **Service status**
   - Check status.code-reviewer.io
   - Known incidents will be posted

### Browser Memory Issues

**Symptoms**: Browser becomes unresponsive with large graphs

**Solutions**:

1. **Limit graph size**
   - Use filters to reduce nodes
   - View subsets of the graph

2. **Browser settings**
   - Increase browser memory limit
   - Close other memory-intensive tabs

3. **Use API**
   - For large graphs, use API to extract data
   - Process offline with appropriate tools

## Getting Help

If these solutions don't resolve your issue:

1. **Check FAQ**: `/support/faq` for common questions
2. **Search documentation**: Use the search bar
3. **Contact support**: support@code-reviewer.io
4. **Include details**:
   - Error messages
   - Browser and version
   - Steps to reproduce
   - Screenshots if helpful

## Next Steps

- [FAQ](/support/faq) - Frequently asked questions
- [Support Runbook](/support/runbook) - Internal operations guide
- [API Error Handling](/api/error-handling) - Understanding API errors
