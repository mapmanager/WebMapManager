# MapManagerCore cudmore-dev Migration Tests

This folder contains comprehensive tests to validate API compatibility when migrating from the current MapManagerCore to the cudmore-dev branch.

## Overview

These tests ensure that the TypeScript ↔ Python API contract remains stable across MapManagerCore branch changes, particularly focusing on the channel import functionality that was broken in the current implementation.

## Test Files

### 1. `pyodide-api-contract.test.ts`
Tests the core API contract between TypeScript and Python, ensuring all required methods exist with correct signatures.

### 2. `channel-import-integration.test.ts`
Integration tests for the channel import workflow, testing the complete flow from file loading to UI updates.

### 3. `pyodide-mock-tests.test.ts`
Mock-based tests that don't require a full Python environment, useful for rapid development and CI/CD.

### 4. `regression-tests.test.ts`
Regression tests to catch breaking changes and ensure existing functionality continues to work.

## Running the Tests

### Prerequisites
- Node.js and Yarn installed
- WebMapManager dependencies installed (`yarn install`)

### Running All Migration Tests
```bash
# From WebMapManager root directory
yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev"
```

### Running Specific Test Files
```bash
# API contract tests
yarn workspace @map-manager/core test --run src/__tests__/migrate-cudmore-dev/pyodide-api-contract.test.ts

# Channel import integration tests
yarn workspace @map-manager/core test --run src/__tests__/migrate-cudmore-dev/channel-import-integration.test.ts

# Mock tests
yarn workspace @map-manager/core test --run src/__tests__/migrate-cudmore-dev/pyodide-mock-tests.test.ts

# Regression tests
yarn workspace @map-manager/core test --run src/__tests__/migrate-cudmore-dev/regression-tests.test.ts
```

### Running Tests in Watch Mode
```bash
# Watch for changes and re-run tests
yarn workspace @map-manager/core test:watch "src/__tests__/migrate-cudmore-dev"
```

### Running Tests with Coverage
```bash
# Generate coverage report
yarn workspace @map-manager/core test --run --coverage "src/__tests__/migrate-cudmore-dev"
```

## Migration Workflow

### Step 1: Baseline Testing
```bash
# Run all tests with current MapManagerCore
yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev"
```
**Expected**: All tests should pass with current implementation.

### Step 2: Switch to cudmore-dev Branch
Follow the instructions in `cudmore-notes/local-dev-setup.md` to switch to the cudmore-dev branch.

### Step 3: Post-Migration Testing
```bash
# Run tests after switching to cudmore-dev
yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev"
```
**Expected**: Some tests may fail, indicating API changes that need to be addressed.

### Step 4: Fix Breaking Changes
Based on test failures:
1. Update TypeScript interfaces in `pyTypes.d.ts` and `types.d.ts`
2. Update method signatures in `pyToJsMM.ts` and `pyToJsMMTimePoint.ts`
3. Fix any return type handling issues
4. Update channel import logic if needed

### Step 5: Validate Channel Import
```bash
# Run specific channel import tests
yarn workspace @map-manager/core test --run "src/__tests__/migrate-cudmore-dev/channel-import-integration.test.ts"
```
**Expected**: Channel import functionality should work correctly.

## Test Categories

### API Contract Tests
- Verify method existence and signatures
- Validate return types
- Check parameter types
- Ensure backward compatibility

### Integration Tests
- Test complete workflows
- Validate data flow
- Check state consistency
- Test error handling

### Mock Tests
- Fast unit tests
- No Python environment required
- Good for CI/CD
- Test TypeScript logic

### Regression Tests
- Catch breaking changes
- Validate existing functionality
- Test edge cases
- Ensure stability

## Key API Methods Tested

### PyodideAnnotations (Main Map)
- `timePoint_js(timePoint: number)`
- `maxChannels()`
- `timePoints_js()`
- `metadata_json(timePoint: number)`
- `deleteChannel(timePoint: number, channel: number)`
- `undo()` / `redo()`
- `save(path: string)`

### PyodideSingleTimePoint
- `getAnnotations_js(options)`
- `slices_js(channel: number, zRange: [number, number])`
- `getSegmentsAndSpines(options)`
- `getSpinePosition(spineId: number)`
- `newSegment()`
- `addSpine(segmentId, x, y, z)`
- `deleteSpine(spineId: number)`
- `setSegmentOrigin(segmentId, x, y, z)`
- `loadFile(path: string, channel?: number, name?: string)`
- `deleteChannel(channel: number)`
- `metadata_json()`
- `shape` (property)
- `onDelete()`

## Troubleshooting

### Common Issues

1. **Tests fail with "Cannot find module"**
   - Ensure all dependencies are installed: `yarn install`
   - Check that test files are in the correct location

2. **Python-related test failures**
   - Some tests require a full Python environment
   - Use mock tests for development without Python

3. **Type errors in tests**
   - Update TypeScript interfaces to match new Python API
   - Check import paths and type definitions

4. **Channel import tests fail**
   - Verify `loadFile()` method signature hasn't changed
   - Check that `maxChannels()` is updated after loading
   - Ensure UI state is properly refreshed

### Debug Mode
```bash
# Run tests with verbose output
yarn workspace @map-manager/core test --run --reporter=verbose "src/__tests__/migrate-cudmore-dev"

# Run single test with debug info
yarn workspace @map-manager/core test --run --reporter=verbose -t "should load channel and update maxChannels" "src/__tests__/migrate-cudmore-dev"
```

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Add appropriate test descriptions
3. Include both positive and negative test cases
4. Update this README if adding new test categories
5. Ensure tests are deterministic and don't depend on external state

## Notes

- These tests are designed to be run both before and after the cudmore-dev migration
- Mock tests can be run without a full Python environment
- Integration tests require the full WebMapManager environment
- Tests should be updated as the API evolves
