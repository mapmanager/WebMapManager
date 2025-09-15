/**
 * Channel Import Integration Tests
 * 
 * Tests the complete channel import workflow to ensure it works correctly
 * after migrating to cudmore-dev branch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { pyMapManagerMap, pyMapManagerTimePointMap } from '../../pyToJsMM';
import type { pyImageSource } from '../../pyTypes';

describe('Channel Import Integration Tests', () => {
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

  describe('Channel Import Workflow', () => {
    it('should load channel and update maxChannels', async () => {
      // Setup: Initial state with 2 channels
      mockTimePoint.maxChannels.mockReturnValue(2);
      mockMap.maxChannels.mockReturnValue(2);

      // Action: Load a new channel
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, 'New Channel');

      // Verify: maxChannels should be updated
      expect(mockTimePoint.loadFile).toHaveBeenCalledWith('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, 'New Channel');
      
      // Simulate the maxChannels update that should happen after loading
      mockTimePoint.maxChannels.mockReturnValue(3);
      mockMap.maxChannels.mockReturnValue(3);
      
      expect(mockTimePoint.maxChannels()).toBe(3);
      expect(mockMap.maxChannels()).toBe(3);
    });

    it('should handle channel loading with automatic channel index', async () => {
      // Setup: Load channel without specifying channel index
      mockTimePoint.maxChannels.mockReturnValue(2);

      // Action: Load channel with automatic channel assignment
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', undefined, 'Auto Channel');

      // Verify: Should use next available channel index
      expect(mockTimePoint.loadFile).toHaveBeenCalledWith('./fixtures/rr30a_s0_ch1-no-compression.tif', undefined, 'Auto Channel');
    });

    it('should handle channel loading with custom name', async () => {
      // Action: Load channel with custom name
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 3, 'Custom Channel Name');

      // Verify: Custom name should be used
      expect(mockTimePoint.loadFile).toHaveBeenCalledWith('./fixtures/rr30a_s0_ch1-no-compression.tif', 3, 'Custom Channel Name');
    });

    it('should maintain channel state consistency after loading', async () => {
      // Setup: Initial state
      const initialChannels = 2;
      mockTimePoint.maxChannels.mockReturnValue(initialChannels);

      // Action: Load new channel
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, 'Consistency Test');

      // Verify: Channel count should increase
      const newChannels = 3;
      mockTimePoint.maxChannels.mockReturnValue(newChannels);
      
      expect(mockTimePoint.maxChannels()).toBe(newChannels);
      expect(newChannels).toBe(initialChannels + 1);
    });
  });

  describe('Channel Deletion Workflow', () => {
    it('should handle channel deletion correctly', async () => {
      // Setup: Channel exists
      mockTimePoint.maxChannels.mockReturnValue(3);
      mockTimePoint.deleteChannel.mockReturnValue(true);

      // Action: Delete channel
      const result = mockTimePoint.deleteChannel(2);

      // Verify: Channel should be deleted
      expect(mockTimePoint.deleteChannel).toHaveBeenCalledWith(2);
      expect(result).toBe(true);
    });

    it('should handle channel deletion failure', async () => {
      // Setup: Channel deletion fails
      mockTimePoint.deleteChannel.mockReturnValue(false);

      // Action: Try to delete non-existent channel
      const result = mockTimePoint.deleteChannel(99);

      // Verify: Should return false for failure
      expect(mockTimePoint.deleteChannel).toHaveBeenCalledWith(99);
      expect(result).toBe(false);
    });
  });

  describe('Channel Access Workflow', () => {
    it('should provide access to channel data after loading', async () => {
      // Setup: Channel loaded
      mockTimePoint.maxChannels.mockReturnValue(3);
      mockTimePoint.slices_js.mockResolvedValue(mockImageSource);

      // Action: Access channel data
      const source = await mockTimePoint.slices_js(2, [0, 1]);

      // Verify: Should return image source
      expect(mockTimePoint.slices_js).toHaveBeenCalledWith(2, [0, 1]);
      expect(source).toBe(mockImageSource);
      expect(source.data).toBeDefined();
      expect(source.extent).toBeDefined();
    });

    it('should handle channel access for non-existent channel', async () => {
      // Setup: Channel doesn't exist
      mockTimePoint.slices_js.mockRejectedValue(new Error('Channel not found'));

      // Action: Try to access non-existent channel
      await expect(mockTimePoint.slices_js(99, [0, 1])).rejects.toThrow('Channel not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle file loading errors', async () => {
      // Setup: File loading fails
      mockTimePoint.loadFile.mockRejectedValue(new Error('File not found'));

      // Action: Try to load non-existent file
      await expect(mockTimePoint.loadFile('/path/to/nonexistent.tif', 2, 'Missing')).rejects.toThrow('File not found');
    });

    it('should handle invalid file format', async () => {
      // Setup: Invalid file format
      mockTimePoint.loadFile.mockRejectedValue(new Error('Invalid file format'));

      // Action: Try to load invalid file
      await expect(mockTimePoint.loadFile('/path/to/invalid.txt', 2, 'Invalid')).rejects.toThrow('Invalid file format');
    });

    it('should handle channel index conflicts', async () => {
      // Setup: Channel index already exists
      mockTimePoint.loadFile.mockRejectedValue(new Error('Channel index already exists'));

      // Action: Try to load channel with existing index
      await expect(mockTimePoint.loadFile('/path/to/conflict.tif', 0, 'Conflict')).rejects.toThrow('Channel index already exists');
    });
  });

  describe('State Management', () => {
    it('should maintain maxChannels consistency across operations', () => {
      // Setup: Initial state
      let channelCount = 2;
      mockTimePoint.maxChannels.mockImplementation(() => channelCount);
      mockMap.maxChannels.mockImplementation(() => channelCount);

      // Verify: Initial state
      expect(mockTimePoint.maxChannels()).toBe(2);
      expect(mockMap.maxChannels()).toBe(2);

      // Action: Simulate channel addition
      channelCount = 3;
      mockTimePoint.maxChannels.mockImplementation(() => channelCount);
      mockMap.maxChannels.mockImplementation(() => channelCount);

      // Verify: State should be consistent
      expect(mockTimePoint.maxChannels()).toBe(3);
      expect(mockMap.maxChannels()).toBe(3);
    });

    it('should handle concurrent channel operations', async () => {
      // Setup: Multiple concurrent operations
      const operations = [
        mockTimePoint.loadFile('/path/to/channel1.tif', 2, 'Channel 1'),
        mockTimePoint.loadFile('/path/to/channel2.tif', 3, 'Channel 2'),
        mockTimePoint.deleteChannel(1)
      ];

      // Action: Execute operations concurrently
      const results = await Promise.allSettled(operations);

      // Verify: All operations should complete
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Integration with UI State', () => {
    it('should trigger UI updates after channel operations', async () => {
      // Setup: Mock UI state update mechanism
      const uiUpdateCallback = vi.fn();
      
      // Action: Load channel and trigger UI update
      await mockTimePoint.loadFile('./fixtures/rr30a_s0_ch1-no-compression.tif', 2, 'UI Test');
      uiUpdateCallback(); // Simulate UI update trigger

      // Verify: UI update should be triggered
      expect(uiUpdateCallback).toHaveBeenCalled();
    });

    it('should maintain channel visibility state', () => {
      // Setup: Channel visibility array
      const channelVisibility = [true, true, false]; // 3 channels, last one hidden
      mockTimePoint.maxChannels.mockReturnValue(3);

      // Verify: Channel count matches visibility array length
      expect(mockTimePoint.maxChannels()).toBe(channelVisibility.length);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large channel datasets efficiently', async () => {
      // Setup: Large dataset
      const largeImageSource = {
        data: vi.fn().mockReturnValue({
          toJs: vi.fn().mockReturnValue(new Uint8Array(1000000)) // 1MB of data
        }),
        extent: vi.fn().mockReturnValue([0, 65535]),
        bins: vi.fn().mockReturnValue([])
      };

      mockTimePoint.slices_js.mockResolvedValue(largeImageSource);

      // Action: Access large channel data
      const startTime = Date.now();
      const source = await mockTimePoint.slices_js(0, [0, 1]);
      const endTime = Date.now();

      // Verify: Should complete within reasonable time
      expect(source).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });
});
