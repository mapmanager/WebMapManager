# Single Timepoint Call Sequence

Technical guide showing the program flow from clicking "Single Timepoint" sample data button to displaying loaded data in the web GUI.

## Overview

The Single Timepoint flow involves:
1. **Sample Data Button Click** → Downloads and extracts ZIP file
2. **File System Setup** → Extracts files to Pyodide virtual filesystem
3. **Python Processing** → Creates MapManagerCore annotations from .mmap files
4. **Data Flow** → Image data flows through TypeScript wrappers
5. **UI Update** → Splash screen disappears, image viewer appears

## Call Sequence

### 1. Sample Data Button Click
**File**: `packages/app/src/components/layout/placeholder.tsx`  
**Lines**: 59-65
```typescript
onClick={() => {
  setLoading(idx);
  MapManagerMap.LoadUrl(url, title, setProgress).finally(() => {
    setLoading(-1);
    setProgress(0);
  });
}}
```

### 2. URL Download and Progress Tracking
**File**: `packages/core/src/pyToJsMM.ts`  
**Lines**: 128-152
```typescript
static async LoadUrl(url: string, title: string, progress: (prog: number) => void) {
  const response = await fetch(url);
  const contentLength = response.headers.get("Content-Length");
  const total = parseInt(contentLength);
  let loaded = 0;
  const reader = response.body?.getReader();
  
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress(Math.round((loaded / total) * 100));
  }
}
```

### 3. ZIP File Processing
**File**: `packages/core/src/pyToJsMM.ts`  
**Lines**: 154-173
```typescript
const data = new Blob(chunks);
const zip = new JSZip();
await zip.loadAsync(data);

await clearOldFiles();
let root = "";
for (let [path, file] of Object.entries(zip.files)) {
  if (file.dir) {
    if (path.endsWith(".mmap/")) root = path;
    continue;
  }
  path = path.slice(root.length);
  path = "/temp.mmap/" + path;
  const data = await file.async("uint8array");
  insureDirectory(path.slice(0, path.lastIndexOf("/")));
  py.FS.writeFile(path, data);
}
```

### 4. Python MapManager Creation
**File**: `packages/core/src/pyToJsMM.ts`  
**Lines**: 175-177
```typescript
const proxy = newPyMapManager("/temp.mmap");
MapManagerMap.replace(new MapManagerMap(proxy, title, undefined));
MapManagerMap.lastSaved.value = DATA_VERSION.peek();
```

### 5. Python createAnnotations Function
**File**: `packages/core/MapManagerCore/mapmanagercore/pyodide_main.py`  
**Lines**: 19-22
```python
def createAnnotations(path: Union[str, None] = None) -> PyodideAnnotations:
    """ Create a PyodideAnnotations object from a given path to zarr `.mmap` file.
    """
    return PyodideAnnotations.load(path, False)
```

### 6. PyodideAnnotations Loading
**File**: `packages/core/MapManagerCore/mapmanagercore/annotations/pyodide.py`  
**Lines**: 122+ (PyodideAnnotations class)
```python
class PyodideAnnotations(Annotations):
    # Inherits from Annotations which loads .mmap files
    # Creates MapManagerCore data structures from zarr files
```

### 7. MapManagerMap Replacement
**File**: `packages/core/src/pyToJsMM.ts`  
**Lines**: 175-177
```typescript
MapManagerMap.replace(new MapManagerMap(proxy, title, undefined));
```

### 8. Global Signal Update
**File**: `packages/core/src/index.ts`  
**Lines**: 15-18
```typescript
export const dataChanged = (didChange: boolean = true) => {
  if (!didChange) return;
  DATA_VERSION.value = DATA_VERSION.peek() + 1;
};
```

### 9. UI Re-render Trigger
**File**: `packages/app/src/components/layout/placeholder.tsx`  
**Lines**: 61-64
```typescript
MapManagerMap.LoadUrl(url, title, setProgress).finally(() => {
  setLoading(-1);
  setProgress(0);
});
```

### 10. Layout System Update
**File**: `packages/app/src/components/layout/index.tsx`  
**Lines**: 153-159
```typescript
onTabSetPlaceHolder={(node) => (
  <Placeholder
    node={node}
    plugins={plugins}
    sampleData={sampleData}
  />
)}
```

## Key Data Flow

1. **URL** → **Fetch** → **ZIP Blob** → **JSZip extraction**
2. **ZIP files** → **Pyodide virtual filesystem** (`/temp.mmap/`)
3. **Virtual filesystem** → **Python PyodideAnnotations.load()**
4. **Python annotations** → **TypeScript MapManagerMap proxy**
5. **MapManagerMap** → **Global mapSignal** → **UI re-render**

## File Structure

Sample data typically contains:
- **`.mmap/`** directory with zarr files
- **Image data** in zarr format
- **Metadata** files
- **Analysis parameters**

## Dependencies

- **JSZip**: ZIP file extraction in browser
- **Pyodide**: Python runtime and virtual filesystem
- **Zarr**: Python data format for scientific arrays
- **MapManagerCore**: Python annotations and image processing
- **Preact Signals**: Reactive state management

## Performance Notes

- **Progress tracking** during download for large files
- **Asynchronous loading** to avoid blocking UI
- **Virtual filesystem** allows Python to access files normally
- **Lazy loading** of image data based on viewport
- **Memory management** through Pyodide's garbage collection

## Error Handling

- **Network errors** during download
- **Invalid ZIP files** or missing .mmap directory
- **Python errors** during annotation loading
- **File system errors** in Pyodide virtual filesystem
