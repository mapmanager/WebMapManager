# Import Channel Call Sequence

Technical guide showing the program flow from clicking "Import Channel" button to displaying loaded image data in the web GUI.

## Overview

The import channel flow involves:
1. **UI Button Click** → File dialog opens
2. **File Selection** → File is read and processed
3. **Python Processing** → Image data is loaded into MapManagerCore
4. **Data Flow** → Image data flows through TypeScript wrappers
5. **Rendering** → WebGL renders the image using Viv/Deck.gl

## Call Sequence

### 1. UI Button Click
**File**: `packages/image-view/src/index.tsx`  
**Lines**: 667-670
```typescript
onClick={async () => {
  setLoading(true);
  annotations.loadChannel().finally(() => setLoading(false));
}}
```

### 2. TypeScript Wrapper - File Dialog
**File**: `packages/core/src/pyToJsMMTimePoint.ts`  
**Lines**: 262-289
```typescript
async loadChannel(channel?: number) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".mmap,.tif";
  input.multiple = false;
  // ... event handlers
  input.click();
}
```

### 3. File Processing
**File**: `packages/core/src/pyToJsMMTimePoint.ts`  
**Lines**: 222-236
```typescript
async loadFile(src: File, channel: number | undefined = undefined): Promise<void> {
  const data = await src.arrayBuffer();
  const name = src.name;
  const dest = "/tmp/temp." + name.split(".").pop();
  py.FS.writeFile(dest, new Uint8Array(data));
  this.#proxy.loadFile(dest, channel, name.split("/").pop());
  py.FS.unlink(dest);
}
```

### 4. Python Processing - File Loading
**File**: `packages/core/MapManagerCore/mapmanagercore/annotations/pyodide.py`  
**Lines**: 87-104
```python
def loadFile(self, path: str, channel: int = None, name: str = None):
    if path.endswith(".tif"):
        loader = MultiImageLoader()
        loader.read(path, time=self._t, channel=channel, name=name)
    self._annotations.loader.merge(loader)
```

### 5. Python Image Loading
**File**: `packages/core/MapManagerCore/mapmanagercore/lazy_geo_pd_images/loader/imageio.py`  
**Lines**: 28-50
```python
def read(self, path: Union[str, np.ndarray], time: int = 0, channel: int = 0, name=None):
    from imageio import imread
    if isinstance(path, str):
        imgData = imread(path)
    else:
        imgData = path
    # Store in self._imagesSrc[time][channel]
```

### 6. Data Change Notification
**File**: `packages/core/src/pyToJsMMTimePoint.ts`  
**Lines**: 259
```typescript
dataChanged(); // Triggers UI re-render
```

### 7. Raster Source Loading
**File**: `packages/app/src/components/utils.ts`  
**Lines**: 162-195
```typescript
export function useRasterSources(map: MapManagerTimePointMap | undefined, viewState: ViewState[]) {
  const futures = viewState.map((state) => {
    return map.source(state).then((source: any) => {
      source.loadChannel = () => map.loadChannel(state.c);
      return source as pyImageChannel;
    });
  });
  return await Promise.all(futures);
}
```

### 8. Image Viewer Rendering
**File**: `packages/app/src/components/ImageViewer.tsx`  
**Lines**: 223-240
```typescript
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

### 9. WebGL Rendering
**File**: `packages/app/src/components/ImageViewer.tsx`  
**Lines**: 358-388
```typescript
<VivViewer
  layerProps={layerProps}
  views={views}
  viewStates={viewStatesArr.value}
  deckProps={{ layers, getTooltip }}
  onViewStateChange={...}
/>
```

## Key Data Flow

1. **File** → **ArrayBuffer** → **Pyodide FS** → **Python numpy array**
2. **Python numpy array** → **MultiImageLoader** → **MapManagerCore**
3. **MapManagerCore** → **TypeScript proxy** → **PixelSource interface**
4. **PixelSource** → **VivViewer** → **WebGL rendering**

## Dependencies

- **Viv/Deck.gl**: WebGL rendering engine
- **Pyodide**: Python-in-browser runtime
- **imageio**: Python image loading library
- **MultiImageLoader**: MapManagerCore image management
- **PixelSource**: Interface between Python and WebGL

## Performance Notes

- Images are loaded asynchronously to avoid blocking UI
- WebGL context sharing allows multiple image views
- Lazy loading of image slices based on viewport
- Automatic contrast adjustment and color mapping
