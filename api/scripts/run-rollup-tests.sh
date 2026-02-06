#!/usr/bin/env bash
#
# run-rollup-tests.sh - Execute Rollup Service Test Suites
# 
# This script runs unit tests, integration tests, and generates coverage reports
# for the Rollup feature in the IaC Dependency Detection API.
#
# Usage:
#   ./scripts/run-rollup-tests.sh [options]
#
# Options:
#   --unit         Run only unit tests
#   --integration  Run only integration tests
#   --coverage     Generate coverage report
#   --watch        Run tests in watch mode
#   --verbose      Enable verbose output
#   --ci           Run in CI mode with JSON output
#   --help         Show this help message

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
RUN_UNIT=true
RUN_INTEGRATION=true
COVERAGE=false
WATCH=false
VERBOSE=false
CI_MODE=false

# Test file paths
UNIT_TEST_FILES=(
  "src/services/rollup/__tests__/rollup-service.test.ts"
  "src/services/rollup/__tests__/rollup-executor.test.ts"
  "src/services/rollup/__tests__/merge-engine.test.ts"
  "src/services/rollup/__tests__/blast-radius-engine.test.ts"
  "src/services/rollup/__tests__/matchers/arn-matcher.test.ts"
  "src/services/rollup/__tests__/matchers/resource-id-matcher.test.ts"
  "src/services/rollup/__tests__/matchers/name-matcher.test.ts"
  "src/services/rollup/__tests__/matchers/tag-matcher.test.ts"
  "src/services/rollup/__tests__/matchers/matcher-factory.test.ts"
)

INTEGRATION_TEST_FILES=(
  "src/services/rollup/__tests__/integration/rollup-api.test.ts"
  "src/services/rollup/__tests__/integration/rollup-execution-flow.test.ts"
)

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
  head -n 20 "$0" | tail -n 17
  exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --unit)
      RUN_UNIT=true
      RUN_INTEGRATION=false
      shift
      ;;
    --integration)
      RUN_UNIT=false
      RUN_INTEGRATION=true
      shift
      ;;
    --coverage)
      COVERAGE=true
      shift
      ;;
    --watch)
      WATCH=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
    --help)
      show_help
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      ;;
  esac
done

# Change to project directory
cd "$PROJECT_DIR"

# Build reporter options
REPORTER="verbose"
if [ "$CI_MODE" = true ]; then
  REPORTER="json"
fi

# Build vitest command options
VITEST_OPTS="run"
if [ "$VERBOSE" = true ]; then
  VITEST_OPTS="$VITEST_OPTS --reporter=verbose"
else
  VITEST_OPTS="$VITEST_OPTS --reporter=$REPORTER"
fi

if [ "$COVERAGE" = true ]; then
  VITEST_OPTS="$VITEST_OPTS --coverage"
fi

if [ "$WATCH" = true ]; then
  VITEST_OPTS="run --watch"
fi

# Run unit tests
run_unit_tests() {
  log_info "Running Rollup Unit Tests..."
  echo ""
  
  local test_files="${UNIT_TEST_FILES[*]}"
  
  if npx vitest $VITEST_OPTS $test_files; then
    log_success "Unit tests completed"
  else
    log_warning "Some unit tests failed"
  fi
  
  echo ""
}

# Run integration tests
run_integration_tests() {
  log_info "Running Rollup Integration Tests..."
  echo ""
  
  local test_files="${INTEGRATION_TEST_FILES[*]}"
  
  if npx vitest $VITEST_OPTS $test_files; then
    log_success "Integration tests completed"
  else
    log_warning "Some integration tests failed"
  fi
  
  echo ""
}

# Generate coverage summary
generate_coverage_summary() {
  if [ "$COVERAGE" = true ] && [ -f "coverage/coverage-summary.json" ]; then
    log_info "Coverage Summary:"
    echo ""
    
    node -e "
      const summary = require('./coverage/coverage-summary.json');
      const total = summary.total;
      console.log('  Statements: ' + total.statements.pct + '%');
      console.log('  Branches:   ' + total.branches.pct + '%');
      console.log('  Functions:  ' + total.functions.pct + '%');
      console.log('  Lines:      ' + total.lines.pct + '%');
    " 2>/dev/null || log_warning "Could not parse coverage summary"
    
    echo ""
  fi
}

# Print test summary
print_summary() {
  echo ""
  echo "=============================================="
  echo "           ROLLUP TEST EXECUTION SUMMARY"
  echo "=============================================="
  echo ""
  
  if [ "$RUN_UNIT" = true ]; then
    echo "Unit Tests:"
    echo "  - Test Files: ${#UNIT_TEST_FILES[@]}"
    echo "  - Components: RollupService, MergeEngine, BlastRadiusEngine"
    echo "               MatcherFactory, ArnMatcher, NameMatcher"
    echo "               ResourceIdMatcher, TagMatcher, RollupExecutor"
    echo ""
  fi
  
  if [ "$RUN_INTEGRATION" = true ]; then
    echo "Integration Tests:"
    echo "  - Test Files: ${#INTEGRATION_TEST_FILES[@]}"
    echo "  - Scenarios: API endpoints, execution flow"
    echo ""
  fi
  
  generate_coverage_summary
  
  echo "=============================================="
}

# Main execution
main() {
  log_info "Rollup Test Runner - Starting"
  echo ""
  echo "Configuration:"
  echo "  - Unit Tests:        $RUN_UNIT"
  echo "  - Integration Tests: $RUN_INTEGRATION"
  echo "  - Coverage:          $COVERAGE"
  echo "  - Watch Mode:        $WATCH"
  echo "  - CI Mode:           $CI_MODE"
  echo ""
  echo "----------------------------------------------"
  echo ""
  
  if [ "$RUN_UNIT" = true ]; then
    run_unit_tests
  fi
  
  if [ "$RUN_INTEGRATION" = true ]; then
    run_integration_tests
  fi
  
  print_summary
  
  log_info "Test execution complete"
}

# Execute main function
main
