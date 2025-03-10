import type { PixelData } from "@vivjs/types/src/index";
import JSZip from "jszip";
import {
  AnnotatedPixelSource,
  RasterSelection,
  ViewSelection,
} from "./annotations";
import {
  AnnotationsOptions,
  ColumnAttributes,
  SegmentsAndSpinesResult,
  newPixelSource,
  pdDataFrame,
  pdSeries,
  pyImageSource,
  pyPixelSource,
  pyPixelSourceTimePoint,
  wrapCatchProxyErrors,
} from "../python";
import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import { ZRange } from "../components/plugins/ImageView";
import type { PyProxy } from "pyodide/ffi";
import { DATA_VERSION, dataChanged } from "../components/plugins/globals";
import { Signal } from "@preact/signals-react";
import { AnalysisParams } from "./analysisParams";

export const enum Position {
  OVER = 0,
  AT = 1,
}

export class PyPixelSourceTimePoint extends AnnotatedPixelSource {
  #proxy: pyPixelSourceTimePoint;
  #empty?: Uint16Array;

  constructor(proxy: pyPixelSourceTimePoint) {
    const defaultStatNames = ["x", "y", "z"];
    super(defaultStatNames);
    this.#proxy = wrapCatchProxyErrors(proxy);
  }

  get shape(): [number, number, number] {
    return this.#proxy.shape.toJs();
  }

  async getRaster(selection: RasterSelection): Promise<PixelData> {
    try {
      if (!(selection.selection as any).raster) {
        const src = await this.source(selection.selection);
        if (!src) {
          (selection.selection as any).raster = {
            data: this.empty(),
            width: this.tileSize,
            height: this.tileSize,
          };
        } else {
          (selection.selection as any).raster = {
            data: src.data().toJs(),
            width: this.tileSize,
            height: this.tileSize,
          };
        }
      }
      return (selection.selection as any).raster;
    } catch (e) {
      if (selection.signal && selection.signal.aborted) throw SIGNAL_ABORTED;
      throw e;
    }
  }

  public async source(
    selection: ViewSelection
  ): Promise<pyImageSource | undefined> {
    if (!(selection as any).src) {
      const [low, high] = PyPixelSourceTimePoint.selectedZRange(
        selection as any
      );
      const len = high - low;
      const { c } = selection;

      // Don't fetch empty/disabled channels
      if (len <= 0) return undefined;
      (selection as any).src = await this.#proxy.slices_js(c, [low, high]);
    }
    return (selection as any).src;
  }

  getTile(sel: RasterSelection): Promise<PixelData> {
    return this.getRaster(sel);
  }

  onTileError(err: Error) {
    console.error(err);
  }

  empty(): Uint16Array {
    if (!this.#empty) {
      this.#empty = new Uint16Array(this.tileSize * this.tileSize * 2);
    }

    return this.#empty;
  }

  getAnnotations(options?: AnnotationsOptions): PyProxy[] {
    return this.#proxy.getAnnotations_js(options);
  }

  getSegmentsAndSpines(
    zRange: ZRange,
    filters?: Set<number> | undefined,
    showAll: boolean = false
  ): SegmentsAndSpinesResult {
    return this.#proxy.getSegmentsAndSpines({
      zRange,
      filters,
      showAll,
    });
  }

  undo() {
    this.#proxy.undo();
  }

  onDelete() {
    return this.#proxy.onDelete();
  }

  redo() {
    this.#proxy.redo();
  }

  newSegment() {
    return this.#proxy.newSegment();
  }

  deleteChannel(channel: number) {
    return this.#proxy.deleteChannel(channel);
  }

  async loadFile(
    src: File,
    channel: number | undefined = undefined
  ): Promise<void> {
    const data = await src.arrayBuffer();
    const name = src.name;
    const dest = "/tmp/temp." + name.split(".").pop();
    try {
      py.FS.writeFile(dest, new Uint8Array(data));
      this.#proxy.loadFile(dest, channel, name.split("/").pop());
      py.FS.unlink(dest);
    } catch (e) {
      console.error(e);
    }
  }

  async loadChannelDrop(
    {
      dataTransfer,
    }: {
      dataTransfer: {
        files: FileList;
      };
    },
    channel?: number
  ): Promise<void> {
    const droppedFiles = dataTransfer?.files;
    if (!droppedFiles) return;

    for (const file of droppedFiles) {
      if (file.name.endsWith(".tif")) {
        await this.loadFile(file, channel);
        continue;
      }
      alert("Invalid file type. Please upload a '.tif' file.");
      return;
    }
    dataChanged();
  }

  async loadChannel(channel?: number) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mmap,.tif";
    input.multiple = false;
    const promise = new Promise<string>((resolve, reject) => {
      input.onchange = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target as HTMLInputElement;
        if (target.files) {
          this.loadChannelDrop(
            {
              dataTransfer: { files: target.files },
            },
            channel
          );
        }
      };

      input.oncancel = () => {
        reject(new Error("User cancelled"));
      };
    });

    input.click();
    return promise;
  }

  public getSpinePosition(
    spineID: number
  ): [x: number, y: number, z: number] | undefined {
    return this.#proxy.getSpinePosition(spineID);
  }

  public columnsAttributes(): Record<string, ColumnAttributes> {
    return JSON.parse(this.#proxy.columnsAttributes_json());
  }

  public getColumn(key: string): Promise<pdSeries> {
    return this.#proxy.getColumn(key);
  }

  public table(): Promise<pdDataFrame> {
    return this.#proxy.table();
  }

  public addSpine(
    segmentId: number,
    x: number,
    y: number,
    z: number
  ): number | undefined {
    return this.#proxy.addSpine(segmentId, x, y, z);
  }

  public setSegmentOrigin(
    segmentId: number,
    x: number,
    y: number,
    z: number
  ): number | undefined {
    return this.#proxy.setSegmentOrigin(segmentId, x, y, z);
  }

  public deleteSpine(spineId: number) {
    this.#proxy.deleteSpine(spineId);
  }

  public deleteSegment(segmentID: number) {
    try {
      this.#proxy.deleteSegment(segmentID);
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }

  public setSegmentColor(segmentID: number, color: [number, number, number]) {
    try {
      this.#proxy.setSegmentColor(segmentID, color);
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }
}

export class PyPixelSource {
  #proxy: pyPixelSource;
  #name: string;
  #mounted?: any;

  private constructor(
    proxy: pyPixelSource,
    name: string = "",
    mounted: any = undefined
  ) {
    this.#proxy = wrapCatchProxyErrors(proxy);
    this.#name = name.length === 0 ? "Untitled" : name;
    this.#mounted = mounted;
  }

  get name() {
    return this.#name;
  }

  get mounted() {
    return this.#mounted;
  }

  static canReplace() {
    const old = window.loaderSignal.peek();
    if (old && old.hasChanges()) {
      return confirm(
        "You have unsaved changes. Are you sure you want to continue?"
      );
    }

    return true;
  }

  static async replace(newLoader: PyPixelSource) {
    const old = window.loaderSignal.peek();
    if (old && old.mounted) await old.save();
    window.loaderSignal.value = newLoader;
  }

  static async empty() {
    if (!PyPixelSource.canReplace()) return;
    PyPixelSource.replace(new PyPixelSource(newPixelSource(), "Untitled"));
    PyPixelSource.lastSaved.value = DATA_VERSION.peek();
  }

  static async LoadUrl(
    url: string,
    title: string,
    progress: (prog: number) => void
  ) {
    if (!PyPixelSource.canReplace()) return;
    const response = await fetch(url);
    if (!response.ok)
      return alert(`Failed to load image: ${response.statusText}`);
    const contentLength = response.headers.get("Content-Length");
    if (!contentLength) return alert("Failed to load image");
    const total = parseInt(contentLength);
    let loaded = 0;
    const reader = response.body?.getReader();
    if (!reader) return alert("Failed to load image");

    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      progress(Math.round((loaded / total) * 100));
    }

    const data = new Blob(chunks);
    const zip = new JSZip();
    await zip.loadAsync(data);

    // TODO: Check if files are valid

    await clearOldFiles();
    let root = "";
    for (let [path, file] of Object.entries(zip.files)) {
      if (file.dir) {
        if (path.endsWith(".mmap/")) root = path;
        continue;
      }
      // remove the root directory
      path = path.slice(root.length);
      path = "/temp.mmap/" + path;
      const data = await file.async("uint8array");
      insureDirectory(path.slice(0, path.lastIndexOf("/")));
      py.FS.writeFile(path, data);
    }

    const proxy = newPixelSource("/temp.mmap");
    PyPixelSource.replace(new PyPixelSource(proxy, title, undefined));
    PyPixelSource.lastSaved.value = DATA_VERSION.peek();
  }

  static async Load(onLoad: () => void = () => {}) {
    if (!PyPixelSource.canReplace()) return;
    let name = "temp.mmap";

    let mounted = undefined;
    if (!(window as any).showDirectoryPicker) {
      name = await loadFolderFallback(onLoad);
    } else {
      let dirHandle;
      try {
        dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });
      } catch (e) {
        if (e instanceof DOMException) {
          if (e.name === "AbortError") return; // User cancelled
        }
      }

      const permissionStatus = await dirHandle.requestPermission({
        mode: "readwrite",
      });

      if (permissionStatus !== "granted") {
        alert("Readwrite access to directory is required");
        return;
      }

      name = dirHandle.name.split("/").pop()!;
      if (!name.endsWith(".mmap")) {
        alert("Directory must end with .mmap");
        return;
      }

      onLoad();
      await clearOldFiles();
      mounted = await py.mountNativeFS("/temp.mmap", dirHandle);
    }

    // TODO: Support loading from a URL
    // } else {
    //   const response = await fetch(src);
    //   if (!response.ok)
    //     throw new Error(`Failed to load image: ${response.statusText}`);

    //   const data = await response.arrayBuffer();
    //   name = path.split("/").pop()!;
    //   py.FS.writeFile("/temp.mmap", new Uint8Array(data));
    // }

    const proxy = newPixelSource("/temp.mmap");
    name = name.split(".").shift()!;
    PyPixelSource.replace(new PyPixelSource(proxy, name, mounted));
    PyPixelSource.lastSaved.value = DATA_VERSION.peek();
  }

  debounce: any = undefined;
  static lastSaved: Signal<number> = new Signal(DATA_VERSION.peek());
  static saving: Signal<boolean> = new Signal(false);

  sync(force = false) {
    if (!this.#mounted) return;
    if (force) return this.save();

    // Debounce the save operation
    this.debounce && clearTimeout(this.debounce);
    this.debounce = setTimeout(async () => {
      this.save();
    }, 2000);
  }

  hasChanges() {
    return PyPixelSource.lastSaved.peek() < DATA_VERSION.peek();
  }

  async save() {
    const version = DATA_VERSION.peek();
    if (version <= PyPixelSource.lastSaved.peek()) return;
    PyPixelSource.saving.value = true;
    try {
      if (await this.#save()) {
        PyPixelSource.lastSaved.value = Math.max(
          version,
          PyPixelSource.lastSaved.peek()
        );
      }
    } finally {
      PyPixelSource.saving.value = false;
    }
  }

  async #save(): Promise<boolean> {
    this.#proxy.save("/temp.mmap");
    // Sync the filesystem if mounted

    if (!this.#mounted && (window as any).showDirectoryPicker) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });

        const permissionStatus = await dirHandle.requestPermission({
          mode: "readwrite",
        });

        if (permissionStatus !== "granted") {
          alert("Readwrite access to directory is required");
          return false;
        }

        const name = dirHandle.name.split("/").pop()!;
        if (!name.endsWith(".mmap")) {
          alert("Folder must end with .mmap");
          return false;
        }

        if (dirHandle.kind !== "directory") {
          alert("Folder must end with .mmap");
          return false;
        }

        const entries = await dirHandle.keys();
        let clearDir = false;
        for await (const entry of entries) {
          if ((entry as string).split("/").some((x) => x.startsWith("."))) {
            clearDir = true;
            continue;
          }

          alert("Directory must be empty");
          return false;
        }

        if (clearDir) {
          for await (const entry of entries) {
            await dirHandle.removeEntry(entry);
          }
        }

        py.runPython("import shutil; shutil.move('/temp.mmap', '/temp2.mmap')");
        this.#mounted = await py.mountNativeFS("/temp.mmap", dirHandle);
        this.#name = name;

        py.runPython(`
import shutil;
import os;
src = "/temp2.mmap/"
dest = "/temp.mmap/"
for dir in os.listdir(src):
  src_dir = os.path.join(src, dir)
  dest_dir = os.path.join(dest, dir)
  shutil.move(src_dir, dest_dir)`);
      } catch (e) {
        if (e instanceof DOMException) {
          if (e.name === "AbortError") return false;
        }
        console.error(e);
        alert("Failed to save file");
        return false;
      }
    }

    if (this.#mounted) {
      await this.#mounted.syncfs(true);
      return true;
    }

    const zipFolder = new JSZip();
    const files = py.FS.lookupPath("/temp.mmap");
    await writeFile(zipFolder, this.#name + ".mmap", files.node);

    const data = await zipFolder.generateAsync({
      compression: "STORE",
      compressionOptions: { level: 0 },
      type: "blob",
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.#name + ".mmap.zip";
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  getTimePoint(timePoint: number): PyPixelSourceTimePoint {
    return new PyPixelSourceTimePoint(this.#proxy.timePoint_js(timePoint));
  }

  undo() {
    this.#proxy.undo();
  }

  redo() {
    this.#proxy.redo();
  }

  public columnsAttributes(): Record<string, ColumnAttributes> {
    return JSON.parse(this.#proxy.columnsAttributes_json());
  }

  public getColumn(key: string): pdSeries {
    return (this.#proxy.getColumn(key) as any).toJs();
  }

  public getColors(key?: string): pdSeries {
    return (this.#proxy.getColors(key) as any).toJs();
  }

  public getSymbols(key?: string): pdSeries {
    return (this.#proxy.getSymbols(key) as any).toJs();
  }

  public table(): pdDataFrame {
    return this.#proxy.table();
  }

  dataTree(): DataTreeNode[] {
    return JSON.parse(this.#proxy.dataTree());
  }

  createTimePoint(): boolean {
    return this.#proxy.createTimePoint();
  }

  deleteTimePoint(timePoint: number): boolean {
    return this.#proxy.deleteTimePoint(timePoint);
  }

  deleteChannel(timePoint: number, channel: number): boolean {
    return this.#proxy.deleteChannel(timePoint, channel);
  }

  updateChannel(
    timePoint: number,
    channel: number,
    updates: Record<string, any>
  ): boolean {
    return this.#proxy.updateChannel(timePoint, channel, updates);
  }

  updateTimePoint(timePoint: number, updates: Record<string, any>): boolean {
    return this.#proxy.updateTimePoint(timePoint, updates);
  }

  maxChannels(): number {
    return this.#proxy.maxChannels();
  }

  timePoints(): number[] {
    return this.#proxy.timePoints_js();
  }

  metadata(time: number): Record<string, any> {
    return JSON.parse(this.#proxy.metadata_json(time));
  }

  setMaxChannels(maxChannels: number): boolean {
    return this.#proxy.setMaxChannels(maxChannels);
  }

  analysisParams(): AnalysisParams {
    return JSON.parse(this.#proxy.analysisParams_js());
  }

  setAnalysisParams(key: string, value: any) {
    if (this.#proxy.setAnalysisParams(key, JSON.stringify(value))) {
      DATA_VERSION.value++;
    }
  }

  nextSpine(spineId: number, offset: 1 | -1): number | undefined {
    return this.#proxy.nextSpine(spineId, offset);
  }

  /**
   * @returns true if the operation results in a data change
   */
  public appendChannelToTimePoint(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number
  ): boolean {
    return this.#proxy.appendChannelToTimePoint(
      srcTimePoint,
      srcChannel,
      destTimePoint
    );
  }

  /**
   * @returns true if the operation results in a data change
   */
  public moveChannel(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number,
    destChannel: number
  ): boolean {
    return this.#proxy.moveChannel(
      srcTimePoint,
      srcChannel,
      destTimePoint,
      destChannel
    );
  }

  /**
   * @returns true if the operation results in a data change
   */
  public moveTimePoint(
    srcTimePoint: number,
    destTimePoint: number,
    dropNodePosition: Position
  ): boolean {
    return this.#proxy.moveTimePoint(
      srcTimePoint,
      destTimePoint,
      dropNodePosition
    );
  }
}

// DATA_VERSION.subscribe(() => {
//   const loader = window.loaderSignal.peek();
//   loader && loader.sync();
// });

window.addEventListener("beforeunload", (event) => {
  const loader = window.loaderSignal.peek();
  if (!loader) return;
  if (PyPixelSource.lastSaved.peek() < DATA_VERSION.peek()) {
    event.preventDefault();
    return "You have attempted to leave this page without saving your changes.";
  }
});

export interface DataTreeNodeChannel {
  channel: number;
  slices: number;
  width: number;
  height: number;
  name: string;
}

export interface DataTreeNode {
  name: string;
  channels?: DataTreeNodeChannel[];
}

async function clearOldFiles() {
  try {
    // @ts-ignore
    await py.FS.unmount("/temp.mmap");
  } catch (e) {}
  try {
    await py.runPython("import shutil; shutil.rmtree('/temp.mmap')");
  } catch (e) {}
}

async function loadFolderFallback(
  onLoad: () => void = () => {}
): Promise<string> {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = false;
  input.webkitdirectory = true;
  const promise = new Promise<string>((resolve, reject) => {
    input.onchange = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as HTMLInputElement;
      if (target.files) {
        const file = target.files[0];
        const rootPath = file.webkitRelativePath.split("/").shift()!;

        if (!rootPath.endsWith(".mmap"))
          return reject(new Error("Directory must end with .mmap"));

        await clearOldFiles();

        insureDirectory("/temp.mmap");
        onLoad();
        for (const file of target.files) {
          let path = file.webkitRelativePath.slice(rootPath.length + 1);
          path = "/temp.mmap/" + path;
          insureDirectory(path.slice(0, path.lastIndexOf("/")));
          py.FS.writeFile(
            path,
            new Uint8Array(await file.arrayBuffer(), 0, file.size)
          );
        }

        resolve(rootPath);
      }
    };

    input.oncancel = () => {
      reject(new Error("User cancelled"));
    };
  });

  input.click();
  return promise;
}

function insureDirectory(path: string) {
  let dirs = path.split("/");
  for (let i = 1; i < dirs.length; i++) {
    const dir = dirs.slice(0, i + 1).join("/");
    try {
      // @ts-ignore
      py.FS.mkdir(dir);
    } catch (e) {}
  }
}

function writeFile(zip: JSZip, path: string, node: any, addPath = false) {
  if (addPath) path = path + "/" + node.name;

  if (!py.FS.isDir(node.mode)) {
    zip.file(path, node.contents.buffer);
    return;
  }

  for (const innerNode of Object.values(node.contents) as any) {
    writeFile(zip, path, innerNode, true);
  }
}
