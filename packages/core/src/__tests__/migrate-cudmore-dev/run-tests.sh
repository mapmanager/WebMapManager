#!/bin/bash

# MapManagerCore cudmore-dev Migration Test Runner
# This script provides easy commands to run the migration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the WebMapManager root directory"
    exit 1
fi

# Check if yarn is available
if ! command -v yarn &> /dev/null; then
    print_error "Yarn is not installed. Please install yarn first."
    exit 1
fi

# Function to run all migration tests
run_all_tests() {
    print_status "Running all migration tests..."
    yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev"
}

# Function to run specific test file
run_test_file() {
    local test_file=$1
    if [ -z "$test_file" ]; then
        print_error "Please specify a test file"
        echo "Available test files:"
        echo "  - pyodide-api-contract.test.ts"
        echo "  - channel-import-integration.test.ts"
        echo "  - pyodide-mock-tests.test.ts"
        echo "  - regression-tests.test.ts"
        exit 1
    fi
    
    print_status "Running test file: $test_file"
    yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev/$test_file"
}

# Function to run tests in watch mode
run_watch_tests() {
    print_status "Running migration tests in watch mode..."
    yarn workspace @map-manager/core test:watch "src/__tests__/migrate-cudmore-dev"
}

# Function to run tests with coverage
run_coverage_tests() {
    print_status "Running migration tests with coverage..."
    yarn workspace @map-manager/core test --run --coverage "src/__tests__/migrate-cudmore-dev"
}

# Function to run baseline tests (before migration)
run_baseline_tests() {
    print_status "Running baseline tests (before cudmore-dev migration)..."
    print_warning "Make sure you're on the current MapManagerCore branch"
    yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev"
}

# Function to run post-migration tests
run_post_migration_tests() {
    print_status "Running post-migration tests (after cudmore-dev migration)..."
    print_warning "Make sure you've switched to the cudmore-dev branch"
    yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev"
}

# Function to show help
show_help() {
    echo "MapManagerCore cudmore-dev Migration Test Runner"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  all                    Run all migration tests"
    echo "  file <filename>        Run specific test file"
    echo "  watch                  Run tests in watch mode"
    echo "  coverage               Run tests with coverage"
    echo "  baseline               Run baseline tests (before migration)"
    echo "  post-migration         Run post-migration tests (after migration)"
    echo "  help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 all"
    echo "  $0 file pyodide-api-contract.test.ts"
    echo "  $0 watch"
    echo "  $0 coverage"
    echo ""
    echo "Available test files:"
    echo "  - pyodide-api-contract.test.ts"
    echo "  - channel-import-integration.test.ts"
    echo "  - pyodide-mock-tests.test.ts"
    echo "  - regression-tests.test.ts"
}

# Main script logic
case "$1" in
    "all")
        run_all_tests
        ;;
    "file")
        run_test_file "$2"
        ;;
    "watch")
        run_watch_tests
        ;;
    "coverage")
        run_coverage_tests
        ;;
    "baseline")
        run_baseline_tests
        ;;
    "post-migration")
        run_post_migration_tests
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    "")
        print_warning "No command specified. Showing help..."
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
