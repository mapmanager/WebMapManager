# WebGL uint16 Data Type Issue Analysis

## Problem Description

**Error Message:**
```
WebGL: INVALID_OPERATION: texImage2D: type UNSIGNED_SHORT but ArrayBufferView not Uint16Array
```

**Location:** Browser console when loading uint16 images in WebMapManager

## Root Cause Analysis

### 1. **Data Flow Issue**
The error occurs in the WebGL texture upload pipeline:

```
Python numpy (uint16) → Pyodide → JavaScript → VivViewer → WebGL texImage2D
```

### 2. **Type Mismatch**
- **WebGL expects**: `Uint16Array` for `UNSIGNED_SHORT` texture type
- **What it receives**: Different array type (likely `Array` or generic `TypedArray`)
- **Result**: WebGL validation fails but continues with fallback

### 3. **Current System Behavior**
- **Python side**: Preserves original dtype (uint8, uint16, etc.) ✅
- **Pyodide bridge**: Transfers uint16 arrays to JavaScript ✅
- **WebGL upload**: Type validation fails ❌
- **Fallback**: Images still display (likely uint8 conversion) ⚠️

## Impact Assessment

### **Current Status: Non-Critical**
- ✅ Images display correctly
- ✅ Core functionality works
- ⚠️ Performance may be suboptimal
- ⚠️ Potential data loss in uint16→uint8 conversion
- ⚠️ Browser compatibility issues on strict WebGL implementations

### **Potential Issues**
1. **Data Loss**: uint16 (0-65535) → uint8 (0-255) conversion
2. **Performance**: Inefficient texture uploads
3. **Memory**: Unnecessary data type conversions
4. **Compatibility**: Some browsers may be stricter about WebGL types

## Code Investigation

### **Key Files Involved**

#### 1. **Data Type Definitions**
**File:** `packages/core/src/pyTypes.d.ts`
```typescript
export interface pyImageSource {
  data(): { toJs: () => SupportedTypedArray };
  extent(): [number, number];
}
```

#### 2. **Data Loading Pipeline**
**File:** `packages/core/src/pyToJsMMTimePoint.ts`
```typescript
// Line 180: Creates Uint16Array for empty data
this.#empty = new Uint16Array(this.tileSize * this.tileSize * 2);
```

#### 3. **WebGL Rendering**
**File:** `packages/app/src/components/ImageViewer.tsx`
```typescript
// Lines 223-240: Layer props passed to VivViewer
const layerProps = viewsProps_.map(({
  id, contrastLimits, colors, channelsVisible, state: selections, loader
}) => ({
  id,
  loader: [loader], // PixelSource passed to Viv
  contrastLimits,
  colors,
  channelsVisible,
  selections,
}));
```

## Proposed Solutions

### **Solution 1: Type Validation in Data Pipeline**

**File:** `packages/core/src/pyToJsMMTimePoint.ts`

Add type validation before data is passed to WebGL:

```typescript
// Add method to ensure proper array types
private ensureCorrectArrayType(data: SupportedTypedArray, expectedType: 'uint8' | 'uint16'): SupportedTypedArray {
  if (expectedType === 'uint16' && !(data instanceof Uint16Array)) {
    console.warn('Converting array to Uint16Array for WebGL compatibility');
    return new Uint16Array(data);
  }
  if (expectedType === 'uint8' && !(data instanceof Uint8Array)) {
    console.warn('Converting array to Uint8Array for WebGL compatibility');
    return new Uint8Array(data);
  }
  return data;
}

// Modify data() method
public data(): SupportedTypedArray {
  const rawData = this.#proxy.data().toJs();
  // Determine expected type based on image metadata
  const extent = this.#proxy.extent();
  const maxValue = extent[1];
  const expectedType = maxValue > 255 ? 'uint16' : 'uint8';
  
  return this.ensureCorrectArrayType(rawData, expectedType);
}
```

### **Solution 2: WebGL Texture Format Detection**

**File:** `packages/app/src/components/utils.ts`

Add texture format detection in the raster loading:

```typescript
// Add to useRasterSources function
export function useRasterSources(map: MapManagerTimePointMap | undefined, viewState: ViewState[]) {
  // ... existing code ...
  
  const futures = viewState.map((state) => {
    if (!state.visible) return Promise.resolve(undefined);
    return map.source(state).then((source: any) => {
      if (!source) return undefined;
      
      // Add WebGL format detection
      const originalData = source.data().toJs();
      const extent = source.extent();
      const maxValue = extent[1];
      
      // Ensure proper array type for WebGL
      let webglData: SupportedTypedArray;
      if (maxValue > 255 && !(originalData instanceof Uint16Array)) {
        webglData = new Uint16Array(originalData);
        console.log('Converted to Uint16Array for WebGL texture upload');
      } else if (maxValue <= 255 && !(originalData instanceof Uint8Array)) {
        webglData = new Uint8Array(originalData);
        console.log('Converted to Uint8Array for WebGL texture upload');
      } else {
        webglData = originalData;
      }
      
      // Override data method to return properly typed array
      source.data = () => ({ toJs: () => webglData });
      
      // ... rest of existing code ...
      return source as pyImageChannel;
    });
  });
  
  // ... rest of function ...
}
```

### **Solution 3: VivViewer Integration Fix**

**File:** `packages/app/src/components/ImageViewer.tsx`

Add pre-processing before passing data to VivViewer:

```typescript
// Add helper function to validate layer props
const validateLayerData = (layerProps: any[]) => {
  return layerProps.map(props => {
    // Check if loader has proper data types
    if (props.loader && props.loader[0]) {
      const loader = props.loader[0];
      // Add data type validation here if needed
      console.log('Layer data validation for WebGL compatibility');
    }
    return props;
  });
};

// Modify the layerProps creation
const layerProps = viewsProps_.map(({
  id, contrastLimits, colors, channelsVisible, state: selections, loader
}) => ({
  id,
  loader: [loader],
  contrastLimits,
  colors,
  channelsVisible,
  selections,
}));

// Validate before passing to VivViewer
const validatedLayerProps = validateLayerData(layerProps);
```

## Implementation Priority

### **Phase 1: Quick Fix (Recommended)**
- Implement **Solution 1** - Type validation in data pipeline
- Add console logging to track data type conversions
- Test with uint16 images to verify WebGL error is resolved

### **Phase 2: Comprehensive Fix**
- Implement **Solution 2** - WebGL format detection
- Add proper error handling for unsupported data types
- Add user feedback for data type conversions

### **Phase 3: Optimization**
- Implement **Solution 3** - VivViewer integration improvements
- Add performance monitoring for texture uploads
- Consider WebGL shader-based rendering for uint16 data

## Testing Strategy

### **Test Cases**
1. **uint8 images**: Verify no regression in existing functionality
2. **uint16 images**: Confirm WebGL error is resolved
3. **Mixed data types**: Test with multiple channels of different bit depths
4. **Performance**: Measure texture upload times before/after fix

### **Validation**
- Monitor browser console for WebGL errors
- Verify image quality and contrast are preserved
- Test on different browsers (Chrome, Firefox, Safari)
- Check memory usage with large uint16 images

## Monitoring

### **Console Logging**
Add these logs to track the fix:

```typescript
console.log('WebGL texture upload:', {
  dataType: data.constructor.name,
  length: data.length,
  maxValue: extent[1],
  webglCompatible: data instanceof Uint16Array || data instanceof Uint8Array
});
```

### **Error Tracking**
Monitor for:
- WebGL validation errors
- Data type conversion warnings
- Performance degradation
- Memory usage spikes

## Conclusion

This WebGL uint16 issue is a **data type compatibility problem** in the texture upload pipeline. While not critical (images still display), it should be addressed for:

1. **Performance optimization**
2. **Data integrity preservation**
3. **Browser compatibility**
4. **Future uint16 feature support**

The recommended approach is to implement **Solution 1** first as a quick fix, then evaluate if additional solutions are needed based on testing results.
