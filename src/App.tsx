import "rsuite/dist/rsuite-no-reset.min.css";
import "intro.js/introjs.css";
import "intro.js/themes/introjs-modern.css";
import Layout from "./components/layout";
import { Loader } from "rsuite";
import { DATA_VERSION, dataChanged } from "./components/plugins/globals";
import { useAsync } from "react-use";
import { loadPyodide } from "./python";
import "./App.scss";
import { PyPixelSource } from "./loaders/py_loader";
import { useSignal } from "@preact/signals-react";
import FileDownloadIcon from "@rsuite/icons/FileDownload";
import FileUploadIcon from "@rsuite/icons/FileUpload";
import PageIcon from "@rsuite/icons/Page";
import SettingsIcon from "@rsuite/icons/Setting";
import WaitIcon from "@rsuite/icons/Wait";
import HelpOutlineIcon from "@rsuite/icons/HelpOutline";
import { Nav } from "rsuite";
import IconPath from "/icon.png";
import { Settings } from "./components/Settings";
import { useEffect } from "react";
import { openHelpMenu } from "./help";

const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    if (event.shiftKey) window.loaderSignal?.peek().redo();
    else window.loaderSignal?.peek().undo();

    dataChanged();
    event.preventDefault();
  }
};

document.addEventListener("keydown", handleKeyDown);
const loadingPiodide = loadPyodide();


export default function App() {
  const { loading, error } = useAsync(async () => {
    await loadingPiodide;
  }, []);

  const saving = PyPixelSource.saving.value;
  const settingsOpen = useSignal(false);
  const outDated = PyPixelSource.lastSaved.value < DATA_VERSION.value;
  const loadingNewProject = useSignal(false);

  useEffect(() => {
    // Handle save shortcut
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        const loader = window.loaderSignal.value;
        if (outDated && !saving && loader) {
          loader.save();
        }
      }
    };

    document.addEventListener("keydown", handleSaveShortcut);

    return () => {
      document.removeEventListener("keydown", handleSaveShortcut);
    };
  }, [outDated, saving]);

  if (error) {
    console.error(error);
    return (
      <div className="flex flex-col justify-center items-center h-full w-full">
        <div className="text-red-500 text-2xl">Failed to load Pyodide</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-full w-full">
        <Loader size="lg" content="Loading Map Manager" />
      </div>
    );
  }

  const loader = window.loaderSignal.value;
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-solid border-[#3c3f43]">
        <div className="flex items-center gap-2">
          <img src={IconPath} className="h-9" />
          <span className="text-md font-bold">Web Map Manager</span>
          <span className="text-md font-medium text-gray-400">
            ({loader.name})
          </span>
        </div>
        <Nav>
          <Nav.Item
            icon={
              loadingNewProject.value ? <WaitIcon spin /> : <FileUploadIcon />
            }
            onClick={() => {
              PyPixelSource.Load(() => (loadingNewProject.value = true))
                .catch((error) => {
                  if (error.message !== "User cancelled")
                    alert("Failed to load project");
                })
                .finally(() => (loadingNewProject.value = false));
            }}
          >
            Open
          </Nav.Item>
          <Nav.Item icon={<PageIcon />} onClick={() => PyPixelSource.empty()}>
            New
          </Nav.Item>
          <Nav.Item
            active={outDated}
            disabled={!outDated}
            icon={
              saving ? (
                <WaitIcon spin />
              ) : (
                <FileDownloadIcon color={outDated ? "#34c3ff" : undefined} />
              )
            }
            onClick={() => loader.save()}
          >
            Save
          </Nav.Item>
          <Nav.Item
            className="ml-2"
            icon={<SettingsIcon />}
            onClick={() => (settingsOpen.value = true)}
          >
            Settings
          </Nav.Item>
          <Nav.Item icon={<HelpOutlineIcon />} onClick={openHelpMenu}>
            Help
          </Nav.Item>
        </Nav>
      </div>
      <Settings loader={loader} open={settingsOpen} />

      <Layout loader={loader} />
    </div>
  );
}
