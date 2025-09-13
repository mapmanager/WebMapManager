/**
 * Test Setup File
 * 
 * Global test setup and mocks
 */

import { vi } from 'vitest';

// Mock global objects that might not be available in test environment
global.fetch = vi.fn();
global.alert = vi.fn();
global.confirm = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Mock File constructor
global.File = class File {
  constructor(
    public chunks: BlobPart[],
    public name: string,
    public options?: FilePropertyBag
  ) {}
} as any;

// Mock FileList
global.FileList = class FileList {
  constructor(public files: File[]) {}
  get length() {
    return this.files.length;
  }
  item(index: number) {
    return this.files[index] || null;
  }
  [index: number]: File;
} as any;

// Mock Blob
global.Blob = class Blob {
  constructor(public chunks: BlobPart[], public options?: BlobPropertyBag) {}
} as any;

// Mock ArrayBuffer
global.ArrayBuffer = ArrayBuffer;

// Mock Uint8Array
global.Uint8Array = Uint8Array;
global.Uint16Array = Uint16Array;
global.Float32Array = Float32Array;

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Only log errors that aren't from our mocks
  if (!args[0]?.toString().includes('Mock')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args: any[]) => {
  // Only log warnings that aren't from our mocks
  if (!args[0]?.toString().includes('Mock')) {
    originalConsoleWarn(...args);
  }
};

// Mock Pyodide to prevent real loading
const mockPyodide = {
  loadPyodide: vi.fn().mockResolvedValue({
    pyimport: vi.fn().mockReturnValue({
      install: vi.fn().mockResolvedValue(undefined),
    }),
    runPythonAsync: vi.fn().mockResolvedValue({}),
    setDebug: vi.fn(),
    loadPackage: vi.fn().mockResolvedValue(undefined),
    FS: {
      writeFile: vi.fn(),
      readFile: vi.fn().mockReturnValue(''),
      mkdir: vi.fn(),
      rmdir: vi.fn(),
      unlink: vi.fn(),
    },
    ffi: {
      PythonError: class MockPythonError extends Error {
        constructor(type: string, message: string) {
          super(message);
          this.name = type;
        }
      },
    },
  }),
  version: '0.27.4',
};

// Mock the pyodide module
vi.mock('pyodide', () => mockPyodide);

// Make mockPyodide available globally for tests
global.mockPyodide = mockPyodide;
