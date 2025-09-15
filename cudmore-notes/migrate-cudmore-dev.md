# MapManagerCore API Usage Summary

## **MapManagerCore API Usage Summary**

### **Core Files That Import MapManagerCore:**

#### **1. Main Application Files:**
- `packages/app/src/App.tsx` - Main app component
- `packages/app/src/index.tsx` - App entry point  
- `packages/app/src/globals.ts` - Global state exports
- `src/index.tsx` - Root application entry

#### **2. Component Files:**
- `packages/app/src/components/utils.ts` - Utility functions
- `packages/app/src/components/nav.tsx` - Navigation component
- `packages/app/src/components/layout/placeholder.tsx` - Layout placeholder
- `packages/app/src/components/Settings.tsx` - Settings component
- `packages/app/src/components/ImageViewer.tsx` - Image viewer component

#### **3. Plugin Files:**
- `packages/image-view/src/index.tsx` - Image view plugin
- `packages/image-view/src/contrast.tsx` - Contrast controls
- `packages/example-plugin/src/index.tsx` - Example plugin

#### **4. Core Package Files:**
- `packages/core/src/load.ts` - Core loading logic
- `packages/core/src/pyToJsMM.ts` - Main MapManager wrapper
- `packages/core/src/pyToJsMMTimePoint.ts` - TimePoint wrapper
- `packages/core/src/pyTypes.d.ts` - Python proxy types
- `packages/core/src/types.d.ts` - TypeScript types

---

### **MapManagerMap API Calls:**

#### **Static Methods:**
- `MapManagerMap.Load()` - Load new project
- `MapManagerMap.LoadUrl()` - Load from URL
- `MapManagerMap.empty()` - Create empty project

#### **Instance Methods:**
- `map.save()` - Save project
- `map.undo()` - Undo operation
- `map.redo()` - Redo operation
- `map.maxChannels()` - Get max channel count
- `map.timePoints()` - Get time points
- `map.metadata(timePoint)` - Get metadata
- `map.getTimePoint(timePoint)` - Get time point map

#### **Properties:**
- `MapManagerMap.saving.value` - Save status
- `MapManagerMap.lastSaved.value` - Last saved timestamp

---

### **MapManagerTimePointMap API Calls:**

#### **Channel Management:**
- `map.loadChannel(channel?)` - Load new channel
- `map.loadChannelDrop(event, channel?)` - Load channel from drop
- `map.deleteChannel(channel)` - Delete channel
- `map.maxChannels()` - Get max channels

#### **Image Data:**
- `map.source(viewState)` - Get image source
- `map.slices_js(channel, zRange)` - Get image slices
- `map.shape` - Get image shape
- `map.metadata()` - Get metadata

#### **Annotations:**
- `map.getAnnotations_js(options)` - Get annotations
- `map.getSegmentsAndSpines(options)` - Get segments/spines
- `map.getSpinePosition(spineId)` - Get spine position

#### **Spine Operations:**
- `map.addSpine(segmentId, x, y, z)` - Add spine
- `map.deleteSpine(spineId)` - Delete spine
- `map.setSegmentOrigin(segmentId, x, y, z)` - Set segment origin
- `map.newSegment()` - Create new segment

#### **Data Operations:**
- `map.table()` - Get data table
- `map.getColumn(name)` - Get column data
- `map.columnsAttributes_json()` - Get column attributes
- `map.onDelete()` - Check if deletion occurred

---

### **pyImageChannel API Calls:**

#### **Channel Operations:**
- `source.loadChannel()` - Load new channel
- `source.loadChannelDrop(event)` - Load from drop
- `source.deleteChannel()` - Delete channel

#### **Image Data:**
- `source.data()` - Get image data
- `source.extent()` - Get data extent
- `source.bins(nBin?)` - Get histogram bins

---

### **Critical API Dependencies for cudmore-dev Migration:**

#### **High Priority (Likely Breaking Changes):**
1. **Channel Management:**
   - `loadChannel()` / `loadChannelDrop()` - Core import functionality
   - `maxChannels()` - Channel count management
   - `deleteChannel()` - Channel removal

2. **Image Loading:**
   - `slices_js()` - Image data retrieval
   - `source()` - Image source creation
   - `shape` - Image dimensions

3. **Data Management:**
   - `getTimePoint()` - Time point access
   - `metadata()` - Metadata retrieval
   - `table()` - Data table access

#### **Medium Priority:**
1. **Annotations:**
   - `getAnnotations_js()` - Annotation rendering
   - `getSegmentsAndSpines()` - Segment/spine data
   - `addSpine()` / `deleteSpine()` - Spine operations

2. **Project Management:**
   - `MapManagerMap.Load()` / `LoadUrl()` - Project loading
   - `save()` / `empty()` - Project operations

#### **Low Priority:**
1. **UI State:**
   - `undo()` / `redo()` - History operations
   - `onDelete()` - Deletion detection

---

### **Files Requiring Updates (Estimated):**

#### **Must Update:**
- `packages/core/src/pyToJsMM.ts` - Main API wrapper
- `packages/core/src/pyToJsMMTimePoint.ts` - TimePoint wrapper
- `packages/core/src/pyTypes.d.ts` - Type definitions
- `packages/image-view/src/index.tsx` - Channel import logic
- `packages/image-view/src/contrast.tsx` - Channel controls

#### **Likely Need Updates:**
- `packages/app/src/components/utils.ts` - Raster source logic
- `packages/core/src/load.ts` - Core initialization
- `packages/app/src/App.tsx` - Project management

#### **May Need Updates:**
- `packages/app/src/components/ImageViewer.tsx` - Image rendering
- `packages/app/src/components/Settings.tsx` - Settings integration

---

### **Migration Strategy Recommendations:**

1. **Start with Core Types** - Update `pyTypes.d.ts` and `types.d.ts` first
2. **Update Main Wrappers** - Fix `pyToJsMM.ts` and `pyToJsMMTimePoint.ts`
3. **Fix Channel Import** - Update image view channel loading logic
4. **Test UI Components** - Verify all components work with new API
5. **Update Tests** - Fix any broken test cases

This summary shows **~15 files** will need updates, with the core API wrappers being the most critical for the channel import functionality you're trying to fix.
