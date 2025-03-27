// Python MapManager  Annotation object to JS MapManager point glue

import JSZip from "jszip";
import { pdDataFrame, pdSeries } from "./pyTypes";
import { wrapCatchProxyErrors } from "./utils";
import { DATA_VERSION, mapSignal } from "./index";
import { Signal } from "@preact/signals-react";
import { AnalysisParams, ColumnAttributes, DropPosition } from "./types";
import { newPyMapManager } from "./load";
import {
  clearOldFiles,
  insureDirectory,
  loadFolderFallback,
  writeFile,
} from "./fileUtils";
import {
  MapManagerTimePointMap,
  pyMapManagerTimePointMap,
} from "./pyToJsMMTimePoint";

// The types of the python annotations proxy object
export interface pyMapManagerMap {
  analysisParams_js(): string;
  setAnalysisParams(key: string, value: any): any;

  timePoint_js(timePoint: number): pyMapManagerTimePointMap;
  metadata_json(timePoint: number): string;

  columnsAttributes_json(): string;
  getColumn(name: string): Promise<pdSeries>;
  getColors(name?: string): Promise<pdSeries>;
  getSymbols(name?: string): Promise<pdSeries>;
  mergeFile(
    path: string,
    timePoint: number | undefined,
    channel: number | undefined,
    name: string | undefined,
    dropNodePosition: DropPosition | undefined,
  ): Promise<void>;
  table(): Promise<pdDataFrame>;

  undo(): void;
  redo(): void;

  save(path: string): void;

  appendChannelToTimePoint(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number,
  ): any;

  moveChannel(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number,
    destChannel: number,
  ): any;

  moveTimePoint(
    srcTimePoint: number,
    destTimePoint: number,
    dropNodePosition: DropPosition,
  ): any;
  createTimePoint(): any;
  dataTree(): any;
  nextSpine(spineId: number, offset: 1 | -1): number | undefined;
  deleteTimePoint(timePoint: number): any;
  deleteChannel(timePoint: number, channel: number): any;
  updateChannel(
    timePoint: number,
    channel: number,
    updates: Record<string, any>,
  ): any;
  updateTimePoint(timePoint: number, updates: Record<string, any>): any;
  maxChannels(): any;
  timePoints_js(): any;
  setMaxChannels(maxChannels: number): any;
  setMaxChannels(maxChannels: number): any;
}

export class MapManagerMap {
  #proxy: pyMapManagerMap;
  #name: string;
  #mounted?: any;

  private constructor(
    proxy: pyMapManagerMap,
    name: string = "",
    mounted: any = undefined,
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
    const old = mapSignal.peek();
    if (old && old.hasChanges()) {
      return confirm(
        "You have unsaved changes. Are you sure you want to continue?",
      );
    }

    return true;
  }

  static async replace(newLoader: MapManagerMap) {
    const old = mapSignal.peek();
    if (old && old.mounted) await old.save();
    mapSignal.value = newLoader;
  }

  static async empty() {
    if (!MapManagerMap.canReplace()) return;
    MapManagerMap.replace(new MapManagerMap(newPyMapManager(), "Untitled"));
    MapManagerMap.lastSaved.value = DATA_VERSION.peek();
  }

  static async LoadUrl(
    url: string,
    title: string,
    progress: (prog: number) => void,
  ) {
    if (!MapManagerMap.canReplace()) return;
    const response = await fetch(url);
    if (!response.ok) {
      return alert(`Failed to load image: ${response.statusText}`);
    }
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

    const proxy = newPyMapManager("/temp.mmap");
    MapManagerMap.replace(new MapManagerMap(proxy, title, undefined));
    MapManagerMap.lastSaved.value = DATA_VERSION.peek();
  }

  static async Load(onLoad: () => void = () => {}) {
    if (!MapManagerMap.canReplace()) return;
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

    const proxy = newPyMapManager("/temp.mmap");
    name = name.split(".").shift()!;
    MapManagerMap.replace(new MapManagerMap(proxy, name, mounted));
    MapManagerMap.lastSaved.value = DATA_VERSION.peek();
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

  hasChanges() {
    return MapManagerMap.lastSaved.peek() < DATA_VERSION.peek();
  }

  async save() {
    const version = DATA_VERSION.peek();
    if (version <= MapManagerMap.lastSaved.peek()) return;
    MapManagerMap.saving.value = true;
    try {
      if (await this.#save()) {
        MapManagerMap.lastSaved.value = Math.max(
          version,
          MapManagerMap.lastSaved.peek(),
        );
      }
    } finally {
      MapManagerMap.saving.value = false;
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

  getTimePoint(timePoint: number): MapManagerTimePointMap {
    return new MapManagerTimePointMap(this.#proxy.timePoint_js(timePoint));
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

  // dataTree(): DataTreeNode[] {
  //   return JSON.parse(this.#proxy.dataTree());
  // }

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
    updates: Record<string, any>,
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
    destTimePoint: number,
  ): boolean {
    return this.#proxy.appendChannelToTimePoint(
      srcTimePoint,
      srcChannel,
      destTimePoint,
    );
  }

  /**
   * @returns true if the operation results in a data change
   */
  public moveChannel(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number,
    destChannel: number,
  ): boolean {
    return this.#proxy.moveChannel(
      srcTimePoint,
      srcChannel,
      destTimePoint,
      destChannel,
    );
  }

  /**
   * @returns true if the operation results in a data change
   */
  public moveTimePoint(
    srcTimePoint: number,
    destTimePoint: number,
    dropNodePosition: DropPosition,
  ): boolean {
    return this.#proxy.moveTimePoint(
      srcTimePoint,
      destTimePoint,
      dropNodePosition,
    );
  }
}
