# Pixel Data Types: Python to JavaScript Bridge

Technical overview of how pixel data types are handled from Python numpy arrays through Pyodide to JavaScript/TypeScript display in WebMapManager.

## Current System Analysis

### 1. **Python Side - Data Type Preservation**

**File**: `packages/core/MapManagerCore/mapmanagercore/lazy_geo_pd_images/loader/imageio.py`  
**Lines**: 44-48, 64-65
```python
# Image loading preserves original dtype
imgData = imread(path)  # Returns np.ndarray with original dtype (uint8, uint16, etc.)

# Metadata captures min/max values
_metaData.metadataContrast.minInt = int(np.min(imgData))
_metaData.metadataContrast.maxInt = int(np.max(imgData))
```

**File**: `packages/core/MapManagerCore/mapmanagercore/lazy_geo_pd_images/loader/base.py`  
**Lines**: 108-115
```python
def dtype(self, t: int) -> np.dtype:
    """Returns the data type of the image data."""
    return np.dtype(str.lower(self.metadata(t)["dtype"]))
```

### 2. **ImageSlice Data Flow**

**File**: `packages/core/MapManagerCore/mapmanagercore/lazy_geo_pd_images/image_slices.py`  
**Lines**: 26-33, 35-42
```python
def data(self) -> np.ndarray:
    """Returns the image data."""
    return self._image.flatten()  # Preserves original dtype

def extent(self) -> Tuple[int, int]:
    """The range of the image data"""
    return (int(np.min(self._image)), int(np.max(self._image.max())))
```

### 3. **Pyodide Bridge - Type Conversion**

**File**: `packages/core/src/pyTypes.d.ts`  
**Lines**: 6-7
```typescript
export interface pyImageSource {
  data(): { toJs: () => SupportedTypedArray };
  extent(): [number, number];
}
```

**File**: `packages/core/src/pyToJsMMTimePoint.ts`  
**Lines**: 153-168
```typescript
public async source(selection: ViewState): Promise<pyImageSource | undefined> {
  // ... 
  (selection as any).src = await this.#proxy.slices_js(c, [low, high]);
  return (selection as any).src;
}
```

### 4. **JavaScript/TypeScript Side**

**File**: `packages/app/src/components/utils.ts`  
**Lines**: 130-154
```typescript
export function useRasters(
  map: MapManagerTimePointMap | undefined,
  viewState: ViewState[],
): {
  rasters?: (SupportedTypedArray | undefined)[];
  error?: Error;
  loading: boolean;
}
```

## Data Type Support Analysis

### **SupportedTypedArray Types**
Based on `@vivjs/types`, `SupportedTypedArray` includes:
- `Uint8Array` - 8-bit unsigned integers (0-255)
- `Uint16Array` - 16-bit unsigned integers (0-65535)
- `Uint32Array` - 32-bit unsigned integers
- `Int8Array`, `Int16Array`, `Int32Array`
- `Float32Array`, `Float64Array`

### **Current Limitations**

1. **No Explicit Type Casting**: The system preserves original numpy dtypes but doesn't explicitly handle uint16→uint8 conversion
2. **WebGL Rendering**: Most WebGL implementations expect 8-bit data for texture uploads
3. **Display Range**: JavaScript canvas/WebGL typically works with 0-255 range

## Key Considerations for uint16 Support

### **1. Memory and Performance**
- **uint16**: 2 bytes per pixel vs 1 byte for uint8
- **Bandwidth**: 2x data transfer from Python to JavaScript
- **WebGL Textures**: May require format conversion for rendering

### **2. Display Range Mapping**
```typescript
// Current: Direct uint8 display (0-255)
// Needed for uint16: Range mapping (0-65535) → (0-255)
const normalizedData = uint16Data.map(value => 
  Math.round((value / 65535) * 255)
);
```

### **3. Pyodide Conversion**
```python
# Python side - preserve dtype
def data(self) -> np.ndarray:
    return self._image.flatten()  # Keeps uint16

# JavaScript side - handle conversion
const jsData = pyImageSource.data().toJs();  # Returns Uint16Array
```

## Implementation Strategy for uint16 Support

### **Option 1: Automatic Range Mapping**
```typescript
// In pyToJsMMTimePoint.ts
private normalizePixelData(data: SupportedTypedArray, extent: [number, number]): Uint8Array {
  if (data instanceof Uint16Array) {
    const [min, max] = extent;
    return new Uint8Array(data.map(value => 
      Math.round(((value - min) / (max - min)) * 255)
    ));
  }
  return data as Uint8Array;
}
```

### **Option 2: User-Controlled Contrast**
```typescript
// Allow user to set display range
interface ContrastSettings {
  min: number;
  max: number;
  autoContrast: boolean;
}
```

### **Option 3: WebGL Shader-Based**
```glsl
// In fragment shader
uniform float minValue;
uniform float maxValue;
uniform sampler2D imageTexture;

void main() {
  float rawValue = texture2D(imageTexture, vTexCoord).r;
  float normalized = (rawValue - minValue) / (maxValue - minValue);
  gl_FragColor = vec4(normalized, normalized, normalized, 1.0);
}
```

## Current Status

**✅ What Works:**
- Python preserves original dtype (uint8, uint16, etc.)
- Pyodide can transfer uint16 arrays to JavaScript
- Metadata captures min/max values for contrast

**❌ What's Missing:**
- Explicit uint16→uint8 conversion for display
- WebGL texture format handling for 16-bit data
- User interface for contrast adjustment

**🔧 What Needs Implementation:**
- Range mapping from uint16 (0-65535) to display range (0-255)
- WebGL texture format selection based on data type
- Contrast controls in the UI

## Recommendations

1. **Implement automatic range mapping** for uint16 data
2. **Add contrast controls** to the image viewer UI
3. **Use WebGL shaders** for efficient 16-bit rendering
4. **Preserve original data** for analysis while displaying normalized versions
5. **Add data type indicators** in the UI to show current bit depth
