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
} from "../python";
import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import { ZRange } from "../components/plugins/ImageView";
import type { PyProxy } from "pyodide/ffi";
import { DATA_VERSION } from "../components/plugins/globals";
import { batch, Signal } from "@preact/signals-react";

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
    this.#proxy = proxy;
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
    this.#proxy = proxy;
    this.#name = name.length === 0 ? "Untitled" : name;
    this.#mounted = mounted;
  }

  static async replace(newLoader: PyPixelSource) {
    const old = window.loaderSignal.peek();
    if (old && old.#mounted) await old.save();
    window.loaderSignal.value = newLoader;
  }

  static async empty() {
    PyPixelSource.replace(new PyPixelSource(await newPixelSource()));
  }

  static async Load(onLoad: ()=> void = () => {}) {
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
        return; // User cancelled
      }

      const permissionStatus = await dirHandle.requestPermission({
        mode: "readwrite",
      });

      if (permissionStatus !== "granted") {
        throw new Error("Readwrite access to directory is required");
      }

      name = dirHandle.name.split("/").pop()!;
      if (!name.endsWith(".mmap"))
        throw new Error("Directory must end with .mmap");

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

    const proxy = await newPixelSource("/temp.mmap");
    name = name.split(".").shift()!;
    PyPixelSource.replace(new PyPixelSource(proxy, name, mounted));
  }

  async merge(
    src: File,
    timePoint: number | undefined = undefined,
    channel: number | undefined = undefined,
    dropNodePosition: Position = 0
  ): Promise<void> {
    const data = await src.arrayBuffer();
    const name = src.name;
    const dest = "/tmp/temp." + name.split(".").pop();
    try {
      py.FS.writeFile(dest, new Uint8Array(data));
      this.#proxy.mergeFile(
        dest,
        timePoint,
        channel,
        name.split("/").pop(),
        dropNodePosition
      );
      py.FS.unlink(dest);
    } catch (e) {
      console.error(e);
    }
  }

  debounce: any = undefined;
  static lastSaved: Signal<number> = new Signal(0);
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

  async save() {
    const version = DATA_VERSION.peek();
    PyPixelSource.saving.value = true;
    try {
      if (version <= PyPixelSource.lastSaved.peek()) return;
      await this.#save();
    } finally {
      batch(() => {
        PyPixelSource.lastSaved.value = Math.max(version, PyPixelSource.lastSaved.peek());
        PyPixelSource.saving.value = false;
      });
    }
  }

  async #save() {
    this.#proxy.save("/temp.mmap");
    // Sync the filesystem if mounted
    if (this.#mounted) {
      await this.#mounted.syncfs(true);
      return;
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
    return boolOrAlert(this.#proxy.createTimePoint());
  }

  deleteTimePoint(timePoint: number): boolean {
    return boolOrAlert(this.#proxy.deleteTimePoint(timePoint));
  }

  deleteChannel(timePoint: number, channel: number): boolean {
    return boolOrAlert(this.#proxy.deleteChannel(timePoint, channel));
  }

  updateChannel(
    timePoint: number,
    channel: number,
    updates: Record<string, any>
  ): boolean {
    return boolOrAlert(this.#proxy.updateChannel(timePoint, channel, updates));
  }

  updateTimePoint(timePoint: number, updates: Record<string, any>): boolean {
    return boolOrAlert(this.#proxy.updateTimePoint(timePoint, updates));
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
    return boolOrAlert(this.#proxy.setMaxChannels(maxChannels));
  }

  /**
   * @returns true if the operation results in a data change
   */
  public appendChannelToTimePoint(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number
  ): boolean {
    return boolOrAlert(
      this.#proxy.appendChannelToTimePoint(
        srcTimePoint,
        srcChannel,
        destTimePoint
      )
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
    return boolOrAlert(
      this.#proxy.moveChannel(
        srcTimePoint,
        srcChannel,
        destTimePoint,
        destChannel
      )
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
    return boolOrAlert(
      this.#proxy.moveTimePoint(srcTimePoint, destTimePoint, dropNodePosition)
    );
  }
}

// Autosave
window.loaderSignal = new Signal<PyPixelSource>();
await PyPixelSource.empty();
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
  } catch (e) {
    console.error(e);
  }
  try {
    py.runPython("import shutil; shutil.rmtree('/temp.mmap')");
  } catch (e) {
    console.error(e);
  }
}

async function loadFolderFallback(onLoad: ()=> void = () => {}): Promise<string> {
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
      console.log("cancelled");
      reject(new Error("User cancelled"));
    };
  });

  input.click();
  return promise;
}

function boolOrAlert(result: any): boolean {
  if (result === true) return true;
  if (result !== false) alert(result);
  return false;
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
