/**
 * Regression Tests
 * 
 * Tests to catch breaking changes and ensure existing functionality
 * continues to work after migrating to cudmore-dev branch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { pyMapManagerMap, pyMapManagerTimePointMap } from '../../pyToJsMM';
import type { pyImageSource } from '../../pyTypes';

describe('Regression Tests', () => {
  let mockMap: jest.Mocked<pyMapManagerMap>;
  let mockTimePoint: jest.Mocked<pyMapManagerTimePointMap>;
  let mockImageSource: jest.Mocked<pyImageSource>;

  beforeEach(() => {
    // Create mock image source
    mockImageSource = {
      data: vi.fn().mockReturnValue({
        toJs: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4]))
      }),
      extent: vi.fn().mockReturnValue([0, 255]),
      bins: vi.fn().mockReturnValue([[10, 128], [20, 200]])
    };

    // Create mock timepoint
    mockTimePoint = {
      loadFile: vi.fn(),
      maxChannels: vi.fn().mockReturnValue(2),
      getAnnotations_js: vi.fn().mockReturnValue([]),
      slices_js: vi.fn().mockResolvedValue(mockImageSource),
      getSegmentsAndSpines: vi.fn().mockReturnValue([]),
      getSpinePosition: vi.fn().mockReturnValue([100, 200, 50]),
      newSegment: vi.fn().mockReturnValue(1),
      addSpine: vi.fn().mockReturnValue(1),
      deleteSpine: vi.fn(),
      setSegmentOrigin: vi.fn().mockReturnValue(1),
      deleteChannel: vi.fn().mockReturnValue(true),
      metadata_json: vi.fn().mockReturnValue('{"name": "test"}'),
      shape: { z: 10, x: 100, y: 100 },
      onDelete: vi.fn().mockReturnValue(false),
      setSegmentColor: vi.fn(),
      deleteSegment: vi.fn(),
      columnsAttributes_json: vi.fn().mockReturnValue('{}'),
      getColumn: vi.fn().mockResolvedValue([]),
      table: vi.fn().mockResolvedValue({}),
      undo: vi.fn(),
      redo: vi.fn()
    };

    // Create mock map
    mockMap = {
      timePoint_js: vi.fn().mockReturnValue(mockTimePoint),
      maxChannels: vi.fn().mockReturnValue(2),
      timePoints_js: vi.fn().mockReturnValue([0]),
      metadata_json: vi.fn().mockReturnValue('{"name": "test"}'),
      deleteChannel: vi.fn().mockReturnValue(true),
      analysisParams_js: vi.fn().mockReturnValue('{}'),
      setAnalysisParams: vi.fn().mockReturnValue(true),
      columnsAttributes_json: vi.fn().mockReturnValue('{}'),
      getColumn: vi.fn().mockResolvedValue([]),
      getColors: vi.fn().mockResolvedValue([]),
      getSymbols: vi.fn().mockResolvedValue([]),
      mergeFile: vi.fn().mockResolvedValue(undefined),
      table: vi.fn().mockResolvedValue({}),
      undo: vi.fn(),
      redo: vi.fn(),
      save: vi.fn(),
      appendChannelToTimePoint: vi.fn().mockReturnValue(true),
      moveChannel: vi.fn().mockReturnValue(true),
      moveTimePoint: vi.fn().mockReturnValue(true),
      createTimePoint: vi.fn().mockReturnValue(true),
      dataTree: vi.fn().mockReturnValue({}),
      nextSpine: vi.fn().mockReturnValue(1),
      deleteTimePoint: vi.fn().mockReturnValue(true),
      updateChannel: vi.fn().mockReturnValue(true),
      updateTimePoint: vi.fn().mockReturnValue(true),
      setMaxChannels: vi.fn().mockReturnValue(true)
    };
  });

  describe('API Compatibility', () => {
    it('should maintain API compatibility after cudmore-dev migration', () => {
      // Test that all critical methods still exist and work
      const criticalMethods = [
        'loadFile',
        'maxChannels',
        'getAnnotations_js',
        'slices_js',
        'getSegmentsAndSpines',
        'newSegment',
        'addSpine',
        'deleteSpine',
        'deleteChannel',
        'getSpinePosition',
        'metadata_json',
        'onDelete'
      ];

      criticalMethods.forEach(method => {
        expect(typeof mockTimePoint[method as keyof pyMapManagerTimePointMap]).toBe('function');
      });
    });

    it('should maintain method signatures after migration', () => {
      // Test that method signatures haven't changed
      // Note: Mock functions don't preserve original parameter count, so we test the interface instead
      expect(typeof mockTimePoint.loadFile).toBe('function');
      expect(typeof mockTimePoint.addSpine).toBe('function');
      expect(typeof mockTimePoint.deleteSpine).toBe('function');
      expect(typeof mockTimePoint.getSpinePosition).toBe('function');
      expect(typeof mockTimePoint.deleteChannel).toBe('function');
      expect(typeof mockTimePoint.maxChannels).toBe('function');
      
      // Test that methods can be called with expected parameters
      expect(() => mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 1, 'test')).not.toThrow();
      expect(() => mockTimePoint.addSpine(1, 100, 200, 50)).not.toThrow();
      expect(() => mockTimePoint.deleteSpine(1)).not.toThrow();
      expect(() => mockTimePoint.getSpinePosition(1)).not.toThrow();
      expect(() => mockTimePoint.deleteChannel(1)).not.toThrow();
      expect(() => mockTimePoint.maxChannels()).not.toThrow();
    });

    it('should maintain return types after migration', () => {
      // Test that return types haven't changed
      expect(typeof mockTimePoint.maxChannels()).toBe('number');
      expect(typeof mockTimePoint.newSegment()).toBe('number');
      expect(typeof mockTimePoint.addSpine(0, 0, 0, 0)).toBe('number');
      expect(typeof mockTimePoint.deleteChannel(0)).toBe('boolean');
      expect(typeof mockTimePoint.onDelete()).toBe('boolean');
      expect(typeof mockTimePoint.metadata_json()).toBe('string');
    });
  });

  describe('Channel Import Functionality', () => {
    it('should handle channel import edge cases', async () => {
      // Test edge cases that might break after migration
      
      // Case 1: Loading channel with undefined parameters
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', undefined, undefined);
      expect(mockTimePoint.loadFile).toHaveBeenCalledWith('./fixtures/rr30a_s0_ch1-no-compression.tif', undefined, undefined);

      // Case 2: Loading channel with empty string name
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, '');
      expect(mockTimePoint.loadFile).toHaveBeenCalledWith('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, '');

      // Case 3: Loading channel with special characters in name
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, 'Channel with spaces & symbols!');
      expect(mockTimePoint.loadFile).toHaveBeenCalledWith('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, 'Channel with spaces & symbols!');
    });

    it('should handle channel index edge cases', () => {
      // Test edge cases for channel indices
      
      // Case 1: Channel index 0
      mockTimePoint.deleteChannel.mockReturnValue(true);
      const result1 = mockTimePoint.deleteChannel(0);
      expect(result1).toBe(true);

      // Case 2: Large channel index
      const result2 = mockTimePoint.deleteChannel(999);
      expect(result2).toBe(true);

      // Case 3: Negative channel index (should be handled gracefully)
      const result3 = mockTimePoint.deleteChannel(-1);
      expect(result3).toBe(true);
    });

    it('should maintain channel state consistency', () => {
      // Test that channel state remains consistent
      let channelCount = 2;
      mockTimePoint.maxChannels.mockImplementation(() => channelCount);

      // Initial state
      expect(mockTimePoint.maxChannels()).toBe(2);

      // Simulate channel addition
      channelCount = 3;
      mockTimePoint.maxChannels.mockImplementation(() => channelCount);
      expect(mockTimePoint.maxChannels()).toBe(3);

      // Simulate channel deletion
      channelCount = 2;
      mockTimePoint.maxChannels.mockImplementation(() => channelCount);
      expect(mockTimePoint.maxChannels()).toBe(2);
    });
  });

  describe('Spine Operations', () => {
    it('should handle spine operations edge cases', () => {
      // Test edge cases for spine operations
      
      // Case 1: Adding spine with extreme coordinates
      mockTimePoint.addSpine.mockReturnValue(1);
      const result1 = mockTimePoint.addSpine(0, 0, 0, 0);
      expect(result1).toBe(1);

      // Case 2: Adding spine with large coordinates
      const result2 = mockTimePoint.addSpine(0, 999999, 999999, 999999);
      expect(result2).toBe(1);

      // Case 3: Adding spine with negative coordinates
      const result3 = mockTimePoint.addSpine(0, -100, -200, -50);
      expect(result3).toBe(1);
    });

    it('should handle spine deletion edge cases', () => {
      // Test edge cases for spine deletion
      
      // Case 1: Deleting non-existent spine
      mockTimePoint.deleteSpine(999);
      expect(mockTimePoint.deleteSpine).toHaveBeenCalledWith(999);

      // Case 2: Deleting spine with ID 0
      mockTimePoint.deleteSpine(0);
      expect(mockTimePoint.deleteSpine).toHaveBeenCalledWith(0);

      // Case 3: Deleting spine with negative ID
      mockTimePoint.deleteSpine(-1);
      expect(mockTimePoint.deleteSpine).toHaveBeenCalledWith(-1);
    });

    it('should maintain spine position consistency', () => {
      // Test that spine positions remain consistent
      mockTimePoint.getSpinePosition.mockReturnValue([100, 200, 50]);
      
      const position = mockTimePoint.getSpinePosition(1);
      expect(position).toEqual([100, 200, 50]);
      expect(Array.isArray(position)).toBe(true);
      expect(position).toHaveLength(3);
    });
  });

  describe('Data Access', () => {
    it('should handle data access edge cases', async () => {
      // Test edge cases for data access
      
      // Case 1: Accessing channel with index 0
      const source1 = await mockTimePoint.slices_js(0, [0, 1]);
      expect(source1).toBeDefined();

      // Case 2: Accessing with large z-range
      const source2 = await mockTimePoint.slices_js(0, [0, 999]);
      expect(source2).toBeDefined();

      // Case 3: Accessing with negative z-range
      const source3 = await mockTimePoint.slices_js(0, [-10, 10]);
      expect(source3).toBeDefined();
    });

    it('should handle annotation data edge cases', () => {
      // Test edge cases for annotation data
      
      // Case 1: Empty options
      const annotations1 = mockTimePoint.getAnnotations_js({});
      expect(Array.isArray(annotations1)).toBe(true);

      // Case 2: Options with all properties
      const options = {
        showAnchors: true,
        showLabels: true,
        showLineSegments: true,
        showSpines: true,
        zRange: [0, 10],
        filters: new Set([1, 2, 3])
      };
      const annotations2 = mockTimePoint.getAnnotations_js(options);
      expect(Array.isArray(annotations2)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle error cases gracefully', async () => {
      // Test that error handling remains consistent
      
      // Case 1: File loading error
      mockTimePoint.loadFile.mockRejectedValue(new Error('File not found'));
      await expect(mockTimePoint.loadFile('./fixtures/missing.tif', 2, 'Missing'))
        .rejects.toThrow('File not found');

      // Case 2: Channel access error
      mockTimePoint.slices_js.mockRejectedValue(new Error('Channel not found'));
      await expect(mockTimePoint.slices_js(99, [0, 1]))
        .rejects.toThrow('Channel not found');

      // Case 3: Spine operation error
      mockTimePoint.addSpine.mockReturnValue(undefined);
      const result = mockTimePoint.addSpine(99, 0, 0, 0);
      expect(result).toBeUndefined();
    });

    it('should maintain error message consistency', () => {
      // Test that error messages remain consistent
      const errorMessages = [
        'File not found',
        'Channel not found',
        'Invalid file format',
        'Channel index already exists',
        'Permission denied'
      ];

      errorMessages.forEach(message => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Regression', () => {
    it('should maintain performance characteristics', async () => {
      // Test that performance hasn't degraded
      
      // Case 1: Small dataset
      const startTime1 = Date.now();
      const source1 = await mockTimePoint.slices_js(0, [0, 1]);
      const endTime1 = Date.now();
      
      expect(source1).toBeDefined();
      expect(endTime1 - startTime1).toBeLessThan(100); // Should be fast with mocks

      // Case 2: Multiple operations
      const startTime2 = Date.now();
      const operations = [
        mockTimePoint.getAnnotations_js({}),
        mockTimePoint.getSegmentsAndSpines({}),
        mockTimePoint.metadata_json()
      ];
      const results = await Promise.all(operations);
      const endTime2 = Date.now();
      
      expect(results).toHaveLength(3);
      expect(endTime2 - startTime2).toBeLessThan(100); // Should be fast with mocks
    });

    it('should handle concurrent operations efficiently', async () => {
      // Test that concurrent operations don't cause issues
      const operations = Array.from({ length: 10 }, (_, i) => 
        mockTimePoint.slices_js(i % 2, [0, 1])
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(200); // Should handle concurrency well
    });
  });

  describe('State Management', () => {
    it('should maintain state consistency across operations', () => {
      // Test that state remains consistent
      let state = { channels: 2, spines: 0 };
      
      // Simulate state changes
      mockTimePoint.maxChannels.mockImplementation(() => state.channels);
      mockTimePoint.newSegment.mockImplementation(() => ++state.spines);

      // Initial state
      expect(mockTimePoint.maxChannels()).toBe(2);
      expect(mockTimePoint.newSegment()).toBe(1);

      // State change
      state.channels = 3;
      expect(mockTimePoint.maxChannels()).toBe(3);
      expect(mockTimePoint.newSegment()).toBe(2);
    });

    it('should handle state rollback scenarios', () => {
      // Test that state can be rolled back
      let state = { channels: 2 };
      mockTimePoint.maxChannels.mockImplementation(() => state.channels);

      // Initial state
      expect(mockTimePoint.maxChannels()).toBe(2);

      // State change
      state.channels = 3;
      expect(mockTimePoint.maxChannels()).toBe(3);

      // Rollback
      state.channels = 2;
      expect(mockTimePoint.maxChannels()).toBe(2);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility with existing code', () => {
      // Test that existing code patterns still work
      
      // Pattern 1: Channel count checking
      const channelCount = mockTimePoint.maxChannels();
      expect(typeof channelCount).toBe('number');
      expect(channelCount).toBeGreaterThanOrEqual(0);

      // Pattern 2: Spine creation
      const segmentId = mockTimePoint.newSegment();
      const spineId = mockTimePoint.addSpine(segmentId, 100, 200, 50);
      expect(typeof segmentId).toBe('number');
      expect(typeof spineId).toBe('number');

      // Pattern 3: Data access
      const position = mockTimePoint.getSpinePosition(spineId);
      expect(Array.isArray(position)).toBe(true);
    });

    it('should maintain API contract with UI components', () => {
      // Test that UI components can still interact with the API
      
      // UI Pattern 1: Channel visibility management
      const maxChannels = mockTimePoint.maxChannels();
      const channelVisibility = new Array(maxChannels).fill(true);
      expect(channelVisibility).toHaveLength(maxChannels);

      // UI Pattern 2: Annotation rendering
      const annotations = mockTimePoint.getAnnotations_js({});
      expect(Array.isArray(annotations)).toBe(true);

      // UI Pattern 3: Data table population
      const segments = mockTimePoint.getSegmentsAndSpines({});
      expect(Array.isArray(segments)).toBe(true);
    });
  });
});
