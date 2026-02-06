#!/bin/bash
#
# SBOM (Software Bill of Materials) Generation Script
#
# Generates a CycloneDX SBOM for security audit and compliance purposes.
# Required by NFR-SEC-009 Security Audit Preparation.
#
# Usage:
#   ./scripts/generate-sbom.sh [options]
#
# Options:
#   --output-dir DIR    Output directory (default: ./security-reports)
#   --format FORMAT     Output format: json, xml (default: json)
#   --include-dev       Include devDependencies
#   --audit-only        Only run npm audit, skip SBOM generation
#   --help              Show this help message
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_DIR="${PROJECT_ROOT}/security-reports"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
OUTPUT_DIR="${DEFAULT_OUTPUT_DIR}"
FORMAT="json"
INCLUDE_DEV=false
AUDIT_ONLY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --include-dev)
            INCLUDE_DEV=true
            shift
            ;;
        --audit-only)
            AUDIT_ONLY=true
            shift
            ;;
        --help)
            head -30 "$0" | tail -n +2 | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}  SBOM Generation & Security Audit    ${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Change to project root
cd "${PROJECT_ROOT}"

# Check if we're in the api directory or project root
if [[ -f "api/package.json" ]]; then
    cd api
    echo -e "${GREEN}Working in api/ directory${NC}"
elif [[ -f "package.json" ]]; then
    echo -e "${GREEN}Working in project root${NC}"
else
    echo -e "${RED}Error: Cannot find package.json${NC}"
    exit 1
fi

# Function to run npm audit
run_npm_audit() {
    local audit_level=$1
    local output_file=$2

    echo -e "\n${YELLOW}Running npm audit (${audit_level} level)...${NC}"

    # Run audit and capture output
    set +e
    if [[ "${INCLUDE_DEV}" == "true" ]]; then
        npm audit --audit-level="${audit_level}" > "${output_file}" 2>&1
    else
        npm audit --production --audit-level="${audit_level}" > "${output_file}" 2>&1
    fi
    local audit_exit_code=$?
    set -e

    return $audit_exit_code
}

# Function to check for critical vulnerabilities
check_vulnerabilities() {
    local audit_file=$1

    # Check for critical/high vulnerabilities
    if grep -q "critical" "${audit_file}" 2>/dev/null; then
        echo -e "${RED}CRITICAL vulnerabilities found!${NC}"
        return 2
    elif grep -q "high" "${audit_file}" 2>/dev/null; then
        echo -e "${YELLOW}HIGH vulnerabilities found!${NC}"
        return 1
    else
        echo -e "${GREEN}No critical or high vulnerabilities found${NC}"
        return 0
    fi
}

# ============================================================================
# Step 1: npm audit
# ============================================================================

echo -e "\n${BLUE}Step 1: Running npm audit${NC}"
echo "----------------------------------------"

AUDIT_FILE="${OUTPUT_DIR}/npm-audit-${TIMESTAMP}.txt"
AUDIT_JSON="${OUTPUT_DIR}/npm-audit-${TIMESTAMP}.json"

# Run text audit
run_npm_audit "high" "${AUDIT_FILE}" || true

# Run JSON audit for programmatic analysis
set +e
if [[ "${INCLUDE_DEV}" == "true" ]]; then
    npm audit --json > "${AUDIT_JSON}" 2>&1
else
    npm audit --production --json > "${AUDIT_JSON}" 2>&1
fi
set -e

# Display summary
echo ""
echo "Audit report saved to: ${AUDIT_FILE}"
echo "Audit JSON saved to: ${AUDIT_JSON}"

# Check vulnerability status
check_vulnerabilities "${AUDIT_FILE}"
VULN_STATUS=$?

# If audit only mode, exit here
if [[ "${AUDIT_ONLY}" == "true" ]]; then
    echo -e "\n${GREEN}Audit complete (--audit-only mode)${NC}"
    exit $VULN_STATUS
fi

# ============================================================================
# Step 2: Generate SBOM
# ============================================================================

echo -e "\n${BLUE}Step 2: Generating SBOM (CycloneDX)${NC}"
echo "----------------------------------------"

SBOM_FILE="${OUTPUT_DIR}/sbom-${TIMESTAMP}.${FORMAT}"

# Check if cyclonedx-npm is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found${NC}"
    exit 1
fi

# Generate SBOM
echo "Generating CycloneDX SBOM..."

set +e
if [[ "${INCLUDE_DEV}" == "true" ]]; then
    npx @cyclonedx/cyclonedx-npm --output-file "${SBOM_FILE}" --output-format "${FORMAT}" 2>&1
else
    npx @cyclonedx/cyclonedx-npm --output-file "${SBOM_FILE}" --output-format "${FORMAT}" --omit dev 2>&1
fi
SBOM_EXIT_CODE=$?
set -e

if [[ $SBOM_EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}SBOM generated successfully: ${SBOM_FILE}${NC}"
else
    echo -e "${YELLOW}Warning: SBOM generation may have encountered issues${NC}"
fi

# ============================================================================
# Step 3: License compliance check
# ============================================================================

echo -e "\n${BLUE}Step 3: Checking license compliance${NC}"
echo "----------------------------------------"

LICENSE_FILE="${OUTPUT_DIR}/licenses-${TIMESTAMP}.txt"

# Check if license-checker is available
set +e
npx license-checker --production --summary > "${LICENSE_FILE}" 2>&1
LICENSE_EXIT_CODE=$?
set -e

if [[ $LICENSE_EXIT_CODE -eq 0 ]]; then
    echo "License summary saved to: ${LICENSE_FILE}"

    # Check for problematic licenses
    COPYLEFT_LICENSES=("GPL" "AGPL" "LGPL" "CC-BY-SA")
    FOUND_COPYLEFT=false

    for license in "${COPYLEFT_LICENSES[@]}"; do
        if grep -q "${license}" "${LICENSE_FILE}" 2>/dev/null; then
            echo -e "${YELLOW}Warning: Found ${license} licensed dependency${NC}"
            FOUND_COPYLEFT=true
        fi
    done

    if [[ "${FOUND_COPYLEFT}" == "false" ]]; then
        echo -e "${GREEN}No copyleft licenses found in production dependencies${NC}"
    fi
else
    echo -e "${YELLOW}Warning: License check skipped (license-checker not available)${NC}"
fi

# ============================================================================
# Step 4: Generate summary report
# ============================================================================

echo -e "\n${BLUE}Step 4: Generating summary report${NC}"
echo "----------------------------------------"

SUMMARY_FILE="${OUTPUT_DIR}/security-summary-${TIMESTAMP}.md"

cat > "${SUMMARY_FILE}" << EOF
# Security Audit Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Project:** $(basename "${PROJECT_ROOT}")

## Files Generated

| File | Description |
|------|-------------|
| npm-audit-${TIMESTAMP}.txt | npm audit text report |
| npm-audit-${TIMESTAMP}.json | npm audit JSON report |
| sbom-${TIMESTAMP}.${FORMAT} | CycloneDX SBOM |
| licenses-${TIMESTAMP}.txt | License summary |

## npm Audit Summary

\`\`\`
$(head -50 "${AUDIT_FILE}" 2>/dev/null || echo "Audit file not available")
\`\`\`

## Dependency Count

\`\`\`
$(npm ls --depth=0 2>/dev/null | wc -l) direct dependencies
$(npm ls --all 2>/dev/null | wc -l) total dependencies (including transitive)
\`\`\`

## Next Steps

1. Review any HIGH or CRITICAL vulnerabilities
2. Update vulnerable dependencies if possible
3. Document accepted risks for unfixable vulnerabilities
4. Include SBOM in release artifacts

## Compliance

- [ ] All critical vulnerabilities addressed
- [ ] All high vulnerabilities addressed or accepted
- [ ] License compliance verified
- [ ] SBOM included in release

---
*Report generated by generate-sbom.sh*
EOF

echo "Summary report saved to: ${SUMMARY_FILE}"

# ============================================================================
# Final Summary
# ============================================================================

echo ""
echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}           Summary                    ${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""
echo "Output directory: ${OUTPUT_DIR}"
echo ""
echo "Files generated:"
echo "  - ${AUDIT_FILE}"
echo "  - ${AUDIT_JSON}"
echo "  - ${SBOM_FILE}"
echo "  - ${LICENSE_FILE}"
echo "  - ${SUMMARY_FILE}"
echo ""

# Final status
if [[ $VULN_STATUS -eq 2 ]]; then
    echo -e "${RED}CRITICAL vulnerabilities found - review required before deployment${NC}"
    exit 2
elif [[ $VULN_STATUS -eq 1 ]]; then
    echo -e "${YELLOW}HIGH vulnerabilities found - review recommended${NC}"
    exit 1
else
    echo -e "${GREEN}Security audit complete - no blocking issues${NC}"
    exit 0
fi
