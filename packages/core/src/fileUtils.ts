import JSZip from "jszip";

/**
 * unmounts and removes the /temp.mmap directory
 */
export async function clearOldFiles() {
  try {
    // @ts-ignore
    await py.FS.unmount("/temp.mmap");
  } catch (e) {}
  try {
    await py.runPython("import shutil; shutil.rmtree('/temp.mmap')");
  } catch (e) {}
}

export async function loadFolderFallback(
  onLoad: () => void = () => {},
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

        if (!rootPath.endsWith(".mmap")) {
          return reject(new Error("Directory must end with .mmap"));
        }

        await clearOldFiles();

        insureDirectory("/temp.mmap");
        onLoad();
        for (const file of target.files) {
          let path = file.webkitRelativePath.slice(rootPath.length + 1);
          path = "/temp.mmap/" + path;
          insureDirectory(path.slice(0, path.lastIndexOf("/")));
          py.FS.writeFile(
            path,
            new Uint8Array(await file.arrayBuffer(), 0, file.size),
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

export function insureDirectory(path: string) {
  let dirs = path.split("/");
  for (let i = 1; i < dirs.length; i++) {
    const dir = dirs.slice(0, i + 1).join("/");
    try {
      // @ts-ignore
      py.FS.mkdir(dir);
    } catch (e) {}
  }
}

/**
 * Writes a file to a zip archive
 * @param zip the zip archive to write to
 * @param path the path to write the file to
 * @param node the node to write
 * @param addPath whether to add the node's name to the path
 */
export function writeFile(
  zip: JSZip,
  path: string,
  node: any,
  addPath = false,
) {
  if (addPath) path = path + "/" + node.name;

  if (!py.FS.isDir(node.mode)) {
    zip.file(path, node.contents.buffer);
    return;
  }

  for (const innerNode of Object.values(node.contents) as any) {
    writeFile(zip, path, innerNode, true);
  }
}
