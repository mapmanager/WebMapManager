# GitHub Issue: Inspector Channel Toggle Removes Channels Instead of Hiding Them

## 🐛 Bug Description

**Summary:** In the Image Viewer inspector, toggling the "show" icon for image channels completely removes the channel from the GUI instead of just hiding it (like other show/hide toggles work).

**Expected Behavior:** Clicking the show/hide icon should toggle channel visibility while keeping the channel available for re-showing.

**Actual Behavior:** Clicking the show/hide icon removes the channel entirely, making it impossible to re-show without reloading data.

## 🔍 Root Cause Analysis

### **Working Examples (Correct Behavior):**
- **Spines, Anchors, Labels, Mini Map** toggles work correctly
- These use simple boolean signals that control visibility without affecting data structure

### **Broken Implementation:**
**File:** `packages/image-view/src/contrast.tsx` (lines 52-56)
```typescript
toggleVisible={(visible) => {
  const newState = [...channelsVisible.peek()];
  newState[channel] = visible;  // ❌ This removes channel when false
  channelsVisible.value = newState as any;
}}
```

**Problem:** The `channelsVisible` array controls **which channels are included** in the view state, not just their visibility. Setting `channelsVisible[channel] = false` removes the channel from the data pipeline entirely.

## 🎯 Proposed Solution

### **Option 1: Separate Visibility State (Recommended)**

1. **Create individual channel visibility signals** (similar to `showSpines`, `showAnchors`, etc.)
2. **Keep `channelsVisible` array intact** (always include all channels)
3. **Add separate visibility tracking** for show/hide state
4. **Update view state logic** to respect both inclusion and visibility

### **Implementation Plan:**

#### **Step 1: Add Dynamic Channel Visibility Signals**
**File:** `packages/image-view/src/index.tsx`
```typescript
// Create dynamic channel visibility array (adapts to any number of channels)
const channelVisibility = useSignal<boolean[]>([]);

// Initialize based on loaded channels
useEffect(() => {
  const maxChannels = map.maxChannels();
  if (maxChannels > 0) {
    // Initialize with all channels visible
    channelVisibility.value = new Array(maxChannels).fill(true);
  }
}, [map, DATA_VERSION.value]);
```

#### **Step 2: Fix toggleVisible Function**
**File:** `packages/image-view/src/contrast.tsx`
```typescript
// Change from modifying channelsVisible to using visibility signals
toggleVisible={(visible) => {
  const newVisibility = [...channelVisibility.peek()];
  newVisibility[channel] = visible;
  channelVisibility.value = newVisibility;
  // Don't modify channelsVisible array - keep channels included
}}
```

#### **Step 3: Update View State Logic**
**File:** `packages/app/src/components/utils.ts`
```typescript
// Modify useRasterSources to respect both channelsVisible and visibility signals
// Filter based on both inclusion and visibility
const futures = viewState.map((state) => {
  const isIncluded = channelsVisible.value[state.c] ?? true;
  const isVisible = channelVisibility.value[state.c] ?? true;
  
  if (!state.visible || !isIncluded || !isVisible) {
    return Promise.resolve(undefined);
  }
  // ... rest of existing logic
});
```

## 📁 Files to Modify

1. **`packages/image-view/src/index.tsx`**
   - Add dynamic channel visibility array
   - Initialize based on loaded channels (`map.maxChannels()`)
   - Update channel visibility logic

2. **`packages/image-view/src/contrast.tsx`**
   - Fix `toggleVisible` function (lines 52-56)
   - Use new visibility signals instead of modifying `channelsVisible`

3. **`packages/app/src/components/utils.ts`**
   - Update `useRasterSources` function to respect visibility signals
   - Ensure channels are filtered based on both inclusion and visibility

## 🧪 Testing Strategy

### **Test Cases:**
1. **Toggle channel visibility** - should hide/show without removing
2. **Multiple channels** - should work independently
3. **Re-show hidden channels** - should restore without data reload
4. **Compare with other toggles** - should behave like Spines/Anchors/Labels

### **Validation:**
- [ ] Channel can be hidden and re-shown
- [ ] No data reload required to re-show channel
- [ ] Behavior matches other show/hide toggles
- [ ] No regression in existing functionality

## 🏷️ Labels

- `bug`
- `ui/ux`
- `image-viewer`
- `inspector`
- `priority-medium`

## 📋 Acceptance Criteria

- [ ] Channel show/hide toggle works like other visibility toggles
- [ ] Hidden channels can be re-shown without data reload
- [ ] No regression in existing channel management
- [ ] Code follows existing patterns (similar to Spines/Anchors/Labels)

## 🔗 Related

- **Sample Data:** Single timepoint mmap file from `src/index.tsx`
- **Working Examples:** Spines, Anchors, Labels toggles in `packages/image-view/src/index.tsx` (lines 642-662)
- **Broken Code:** `packages/image-view/src/contrast.tsx` (lines 52-56)

## 💡 Additional Notes

This bug affects the user experience when working with multi-channel images. Users expect consistent behavior across all show/hide toggles in the inspector. The fix should maintain the existing architecture while providing the expected toggle behavior.

**Priority:** Medium - affects usability but doesn't break core functionality.
