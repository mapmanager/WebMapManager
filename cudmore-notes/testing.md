# Pyodide Bridge Testing Guide

This guide covers testing the TypeScript ↔ Python bridge layer in WebMapManager.

## Test Structure

### TypeScript Tests (`packages/core/src/__tests__/`)
- **`pyodide-integration.test.ts`** - Tests the TypeScript side of the bridge
- **`api-contract.test.ts`** - Tests API stability across branch changes
- **`error-handling.test.ts`** - Tests Python error propagation and handling

### Python Tests (`packages/core/tests/python/`)
- **`test_pyodide_interface.py`** - Tests Python classes and interfaces
- **`test_api_stability.py`** - Tests API contract stability

## Initial Setup

### First Time Setup
```bash
# Navigate to the core package
cd packages/core

# Install dependencies (including test dependencies)
yarn install

# Verify test setup works
yarn test
```

### Dependencies Installed
The test setup includes:
- **vitest** - Modern testing framework
- **jsdom** - DOM environment for tests
- **@types/jest** - TypeScript types for testing

## Running Tests

### TypeScript Tests
```bash
# Run all TypeScript tests (non-interactive mode)
yarn test --run

# Run tests in watch mode
yarn test:watch

# Run specific test file
yarn test --run pyodide-integration.test.ts
```

**Note**: Use `--run` flag to avoid interactive prompts when tests fail.

**Current Status**: 
- ✅ **API Contract Tests** - Working (9 tests passing)
- ⏸️ **Integration Tests** - Temporarily disabled (need better mocking)
- ⏸️ **Error Handling Tests** - Temporarily disabled (need better mocking)

### Python Tests
```bash
# Run Python tests directly (if copied to MapManagerCore)
cd ../MapManagerCore
python -m pytest tests/test_pyodide_bridge.py -v
```

## Test Categories

### 1. Integration Tests
Test the actual TypeScript ↔ Python bridge functionality:
- MapManagerMap creation and operations
- MapManagerTimePointMap image loading
- Data flow between layers

### 2. API Contract Tests
Ensure the API remains stable across MapManagerCore branch changes:
- Method signatures
- Return types
- Parameter types
- Interface stability

### 3. Error Handling Tests
Test Python error propagation and recovery:
- Python exception handling
- Error message formatting
- Graceful degradation
- Recovery mechanisms

### 4. Data Type Tests
Test handling of different data types:
- Numpy array serialization
- JSON encoding/decoding
- Image data types (uint8, uint16)
- Type conversions

## Adding New Tests

### TypeScript Tests
1. Create test file in `src/__tests__/`
2. Import required modules and mocks
3. Use Vitest testing framework
4. Mock Pyodide and Python objects

### Python Tests
1. Create test file in `tests/python/`
2. Use pytest framework
3. Mock MapManagerCore classes
4. Test Python interfaces directly

## Mock Strategy

### TypeScript Mocks
- Mock `globalThis.py` for Pyodide
- Mock Python proxy objects
- Mock file system operations
- Mock network requests

### Python Mocks
- Mock MapManagerCore classes
- Mock file I/O operations
- Mock numpy operations
- Mock external dependencies

## Test Data

### Fixtures
- Sample image data
- Test configuration files
- Mock annotation data
- Expected output data

### Test Files
- Small test images
- Sample .mmap files
- Configuration files
- Expected results

## Continuous Integration

### Pre-commit Hooks
- Run TypeScript tests
- Check API contracts
- Validate error handling

### Branch Testing
- Test against different MapManagerCore branches
- Validate API compatibility
- Check for breaking changes
- Ensure backward compatibility

## Troubleshooting

### Common Issues

1. **Pyodide not loading**: Check that Pyodide is properly mocked
2. **Python imports failing**: Ensure MapManagerCore is available
3. **Type errors**: Check TypeScript interface definitions
4. **Test timeouts**: Increase timeout for slow operations

### Debug Mode
```bash
# Run tests with debug output
yarn test -- --reporter=verbose

# Run specific test with debug
yarn test -- --reporter=verbose pyodide-integration.test.ts
```

## Best Practices

1. **Mock external dependencies** - Don't rely on real Pyodide in unit tests
2. **Test error cases** - Ensure graceful handling of failures
3. **Validate data types** - Check that data flows correctly between layers
4. **Keep tests fast** - Use mocks to avoid slow operations
5. **Document test purpose** - Clear descriptions of what each test validates

## Workflow for Branch Changes

### Before Switching MapManagerCore Branches
```bash
# Run tests to establish baseline
cd packages/core
yarn test
```

### After Switching MapManagerCore Branches
```bash
# Run tests to check for breaking changes
cd packages/core
yarn test

# Look for:
# - API contract failures
# - Method signature changes
# - Return type changes
# - New error conditions
```

### If Tests Fail
1. **Check API contract tests** - See what methods/signatures changed
2. **Review error handling tests** - See if new error types were introduced
3. **Update TypeScript interfaces** - If Python API changed
4. **Update mocks** - If new methods were added
5. **Add new tests** - For new functionality
