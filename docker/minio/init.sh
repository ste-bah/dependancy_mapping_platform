#!/bin/sh
# =============================================================================
# Dependency Mapping Platform - MinIO Initialization
# TASK-DEV-004: Create default buckets and lifecycle policies
# =============================================================================

set -e

echo "Waiting for MinIO to be ready..."
sleep 5

echo "Configuring MinIO client..."
mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

echo "Creating default buckets..."

# Main repository storage bucket
mc mb local/dmp-repos --ignore-existing
echo "Created bucket: dmp-repos"

# Scan artifacts bucket (for analysis results)
mc mb local/dmp-scans --ignore-existing
echo "Created bucket: dmp-scans"

# Temporary storage bucket
mc mb local/dmp-temp --ignore-existing
echo "Created bucket: dmp-temp"

echo "Setting lifecycle policies..."

# Delete temporary objects after 7 days
mc ilm rule add local/dmp-repos --prefix "temp/" --expire-days 7 2>/dev/null || \
  echo "Lifecycle rule for dmp-repos/temp/ may already exist"

# Delete scan artifacts after 30 days
mc ilm rule add local/dmp-scans --prefix "" --expire-days 30 2>/dev/null || \
  echo "Lifecycle rule for dmp-scans may already exist"

# Delete all temp bucket objects after 1 day
mc ilm rule add local/dmp-temp --prefix "" --expire-days 1 2>/dev/null || \
  echo "Lifecycle rule for dmp-temp may already exist"

echo "Verifying bucket configuration..."
mc ls local/

echo "MinIO initialization complete!"
