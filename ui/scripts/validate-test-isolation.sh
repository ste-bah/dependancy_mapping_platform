#!/usr/bin/env bash
#
# validate-test-isolation.sh
# Validates vitest configuration for proper test isolation.
# Returns exit code 1 if isolation issues are detected.
#
# Rules enforced:
#   TI-001: Detect singleFork: true or isolate: false (CRITICAL, blocking)
#   TI-002: Check mockReset, restoreMocks, clearMocks are true (HIGH, blocking)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/vitest.config.ts"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "Validating test isolation configuration..."

# Check if config file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}ERROR: vitest.config.ts not found at $CONFIG_FILE${NC}"
    exit 1
fi

CONFIG_CONTENT=$(cat "$CONFIG_FILE")

# ============================================================================
# TI-001: Check for forbidden isolation patterns (CRITICAL)
# ============================================================================

# Check for singleFork: true (forbidden - breaks isolation)
if echo "$CONFIG_CONTENT" | grep -qE 'singleFork\s*:\s*true'; then
    echo -e "${RED}[TI-001] CRITICAL: singleFork is set to true${NC}"
    echo "         Tests will share the same process, causing state leakage."
    echo "         Fix: Set singleFork: false in vitest.config.ts"
    ERRORS=$((ERRORS + 1))
fi

# Check for isolate: false (forbidden - disables isolation)
if echo "$CONFIG_CONTENT" | grep -qE 'isolate\s*:\s*false'; then
    echo -e "${RED}[TI-001] CRITICAL: isolate is set to false${NC}"
    echo "         Test isolation is disabled, causing flaky tests."
    echo "         Fix: Set isolate: true in vitest.config.ts"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# TI-002: Check for required mock reset settings (HIGH)
# ============================================================================

# Check mockReset is true
if echo "$CONFIG_CONTENT" | grep -qE 'mockReset\s*:\s*false'; then
    echo -e "${RED}[TI-002] ERROR: mockReset is set to false${NC}"
    echo "         Mocks will persist between tests."
    echo "         Fix: Set mockReset: true in vitest.config.ts"
    ERRORS=$((ERRORS + 1))
elif ! echo "$CONFIG_CONTENT" | grep -qE 'mockReset\s*:\s*true'; then
    echo -e "${YELLOW}[TI-002] WARNING: mockReset not explicitly set to true${NC}"
    echo "         Consider adding mockReset: true for explicit mock cleanup."
    WARNINGS=$((WARNINGS + 1))
fi

# Check restoreMocks is true
if echo "$CONFIG_CONTENT" | grep -qE 'restoreMocks\s*:\s*false'; then
    echo -e "${RED}[TI-002] ERROR: restoreMocks is set to false${NC}"
    echo "         Mock implementations will persist between tests."
    echo "         Fix: Set restoreMocks: true in vitest.config.ts"
    ERRORS=$((ERRORS + 1))
elif ! echo "$CONFIG_CONTENT" | grep -qE 'restoreMocks\s*:\s*true'; then
    echo -e "${YELLOW}[TI-002] WARNING: restoreMocks not explicitly set to true${NC}"
    echo "         Consider adding restoreMocks: true for explicit mock cleanup."
    WARNINGS=$((WARNINGS + 1))
fi

# Check clearMocks is true
if echo "$CONFIG_CONTENT" | grep -qE 'clearMocks\s*:\s*false'; then
    echo -e "${RED}[TI-002] ERROR: clearMocks is set to false${NC}"
    echo "         Mock call history will persist between tests."
    echo "         Fix: Set clearMocks: true in vitest.config.ts"
    ERRORS=$((ERRORS + 1))
elif ! echo "$CONFIG_CONTENT" | grep -qE 'clearMocks\s*:\s*true'; then
    echo -e "${YELLOW}[TI-002] WARNING: clearMocks not explicitly set to true${NC}"
    echo "         Consider adding clearMocks: true for explicit mock cleanup."
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Test isolation validation FAILED${NC}"
    echo -e "  Errors: $ERRORS"
    echo -e "  Warnings: $WARNINGS"
    echo ""
    echo "Tests cannot run until isolation issues are fixed."
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Test isolation validation passed with warnings${NC}"
    echo -e "  Warnings: $WARNINGS"
    echo ""
else
    echo -e "${GREEN}Test isolation validation passed${NC}"
    echo "  All isolation checks passed."
fi

exit 0
