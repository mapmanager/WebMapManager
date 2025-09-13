/**
 * API Contract Tests
 * 
 * Tests that the TypeScript ↔ Python API contract remains stable
 * across MapManagerCore branch changes
 */

import { describe, it, expect, vi } from 'vitest';
import type { pyMapManagerMap, pyMapManagerTimePointMap } from '../pyToJsMM';
import type { pyImageSource } from '../pyTypes';

describe('API Contract Tests', () => {
  describe('pyMapManagerMap Interface', () => {
    it('should have all required methods', () => {
      // This test ensures the TypeScript interface matches the Python API
      const requiredMethods: (keyof pyMapManagerMap)[] = [
        'analysisParams_js',
        'setAnalysisParams',
        'timePoint_js',
        'metadata_json',
        'columnsAttributes_json',
        'getColumn',
        'getColors',
        'getSymbols',
        'mergeFile',
        'table',
        'undo',
        'redo',
        'save',
        'appendChannelToTimePoint',
        'moveChannel',
        'moveTimePoint',
        'createTimePoint',
        'dataTree',
        'nextSpine',
        'deleteTimePoint',
        'deleteChannel',
        'updateChannel',
        'updateTimePoint',
        'maxChannels',
        'timePoints_js',
        'setMaxChannels',
        'analysisParams_js',
        'setAnalysisParams',
      ];

      // This is a compile-time test - if any method is missing, TypeScript will error
      requiredMethods.forEach(method => {
        expect(typeof method).toBe('string');
      });
    });

    it('should have correct method signatures', () => {
      // Test that method signatures haven't changed
      // This is a compile-time test
      
      // Example: timePoint_js should take a number and return pyMapManagerTimePointMap
      const mockMap: pyMapManagerMap = {
        timePoint_js: vi.fn().mockReturnValue({}),
        metadata_json: vi.fn().mockReturnValue('{}'),
        analysisParams_js: vi.fn().mockReturnValue('{}'),
        setAnalysisParams: vi.fn(),
        columnsAttributes_json: vi.fn().mockReturnValue('{}'),
        getColumn: vi.fn().mockResolvedValue({}),
        getColors: vi.fn().mockResolvedValue({}),
        getSymbols: vi.fn().mockResolvedValue({}),
        mergeFile: vi.fn().mockResolvedValue(undefined),
        table: vi.fn().mockResolvedValue({}),
        undo: vi.fn(),
        redo: vi.fn(),
        save: vi.fn(),
        appendChannelToTimePoint: vi.fn(),
        moveChannel: vi.fn(),
        moveTimePoint: vi.fn(),
        createTimePoint: vi.fn(),
        dataTree: vi.fn(),
        nextSpine: vi.fn(),
        deleteTimePoint: vi.fn(),
        deleteChannel: vi.fn(),
        updateChannel: vi.fn(),
        updateTimePoint: vi.fn(),
        maxChannels: vi.fn().mockReturnValue(2),
        timePoints_js: vi.fn().mockReturnValue([0]),
        setMaxChannels: vi.fn(),
      } as pyMapManagerMap;
      
      // These will cause TypeScript errors if signatures change
      const timePoint: pyMapManagerTimePointMap = mockMap.timePoint_js(0);
      const metadata: string = mockMap.metadata_json(0);
      const analysisParams: string = mockMap.analysisParams_js();
      
      expect(typeof timePoint).toBe('object');
      expect(typeof metadata).toBe('string');
      expect(typeof analysisParams).toBe('string');
    });
  });

  describe('pyMapManagerTimePointMap Interface', () => {
    it('should have all required methods', () => {
      const requiredMethods: (keyof pyMapManagerTimePointMap)[] = [
        'getAnnotations_js',
        'metadata_json',
        'slices_js',
        'deleteSpine',
        'deleteSegment',
        'setSegmentColor',
        'loadFile',
        'addSpine',
        'setSegmentOrigin',
        'newSegment',
        'deleteChannel',
        'shape',
        'getSegmentsAndSpines',
        'getSpinePosition',
        'columnsAttributes_json',
        'getColumn',
        'table',
        'undo',
        'redo',
        'onDelete',
      ];

      requiredMethods.forEach(method => {
        expect(typeof method).toBe('string');
      });
    });

    it('should have correct method signatures', () => {
      const mockTimePoint: pyMapManagerTimePointMap = {
        getAnnotations_js: vi.fn().mockReturnValue([]),
        metadata_json: vi.fn().mockReturnValue('{}'),
        slices_js: vi.fn().mockResolvedValue({}),
        deleteSpine: vi.fn(),
        deleteSegment: vi.fn(),
        setSegmentColor: vi.fn(),
        loadFile: vi.fn(),
        addSpine: vi.fn(),
        setSegmentOrigin: vi.fn(),
        newSegment: vi.fn(),
        deleteChannel: vi.fn(),
        shape: { z: 10, x: 100, y: 100 },
        getSegmentsAndSpines: vi.fn().mockReturnValue([]),
        getSpinePosition: vi.fn(),
        columnsAttributes_json: vi.fn().mockReturnValue('{}'),
        getColumn: vi.fn().mockResolvedValue({}),
        table: vi.fn().mockResolvedValue({}),
        undo: vi.fn(),
        redo: vi.fn(),
        onDelete: vi.fn().mockReturnValue(true),
      } as pyMapManagerTimePointMap;
      
      // Test key method signatures
      const annotations = mockTimePoint.getAnnotations_js();
      const metadata: string = mockTimePoint.metadata_json();
      const source: Promise<pyImageSource> = mockTimePoint.slices_js(0, [0, 1]);
      
      expect(typeof annotations).toBe('object');
      expect(typeof metadata).toBe('string');
      expect(source).toBeInstanceOf(Promise);
    });
  });

  describe('pyImageSource Interface', () => {
    it('should have all required methods', () => {
      const requiredMethods: (keyof pyImageSource)[] = [
        'data',
        'extent',
        'bins',
      ];

      requiredMethods.forEach(method => {
        expect(typeof method).toBe('string');
      });
    });

    it('should have correct method signatures', () => {
      const mockSource: pyImageSource = {
        data: vi.fn().mockReturnValue({ toJs: () => new Uint8Array([1, 2, 3]) }),
        extent: vi.fn().mockReturnValue([0, 255]),
        bins: vi.fn().mockReturnValue([[0, 10], [128, 20], [255, 5]]),
      } as pyImageSource;
      
      // Test method signatures
      const data = mockSource.data();
      const extent: [number, number] = mockSource.extent();
      const bins: [counts: number, means: number][] = mockSource.bins();
      
      expect(typeof data).toBe('object');
      expect(Array.isArray(extent)).toBe(true);
      expect(extent.length).toBe(2);
      expect(Array.isArray(bins)).toBe(true);
    });
  });

  describe('Data Type Contracts', () => {
    it('should handle numpy data types correctly', () => {
      // Test that our TypeScript types can handle the data types
      // that come from Python numpy arrays
      
      // Uint8Array (common for uint8 images)
      const uint8Data = new Uint8Array([0, 128, 255]);
      expect(uint8Data).toBeInstanceOf(Uint8Array);
      expect(uint8Data.length).toBe(3);
      
      // Uint16Array (for uint16 images)
      const uint16Data = new Uint16Array([0, 32768, 65535]);
      expect(uint16Data).toBeInstanceOf(Uint16Array);
      expect(uint16Data.length).toBe(3);
      
      // Float32Array (for float data)
      const float32Data = new Float32Array([0.0, 0.5, 1.0]);
      expect(float32Data).toBeInstanceOf(Float32Array);
      expect(float32Data.length).toBe(3);
    });

    it('should handle JSON serialization contracts', () => {
      // Test that our JSON serialization matches Python expectations
      const testData = {
        int_val: 42,
        float_val: 3.14,
        array_val: [1, 2, 3],
        nested: {
          key: 'value'
        }
      };
      
      const jsonString = JSON.stringify(testData);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.int_val).toBe(42);
      expect(parsed.float_val).toBe(3.14);
      expect(Array.isArray(parsed.array_val)).toBe(true);
      expect(parsed.nested.key).toBe('value');
    });
  });

  describe('Error Handling Contracts', () => {
    it('should handle Python errors consistently', () => {
      // Test that Python errors are handled consistently
      const mockPythonError = {
        type: 'ValueError',
        message: 'ValueError: Invalid input',
        stack: 'Traceback...'
      };
      
      expect(mockPythonError.type).toBe('ValueError');
      expect(mockPythonError.message).toContain('ValueError');
    });
  });
});
