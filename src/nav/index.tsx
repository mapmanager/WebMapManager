import { Sidenav, Nav } from "rsuite";
import FileDownloadIcon from "@rsuite/icons/FileDownload";
import WaitIcon from "@rsuite/icons/Wait";
import { PyPixelSource } from "../loaders/py_loader";
import { signal } from "@preact/signals-react";
import { DATA_VERSION } from "../components/plugins/globals";

export let NavBarElements = signal<any>(undefined);

export const MainNavBar = ({ loader }: { loader: PyPixelSource }) => {
  const NavBarElementsComp = NavBarElements.value;
  const saving = PyPixelSource.saving.value;
  const outDated = PyPixelSource.lastSaved.value < DATA_VERSION.value;

  return (
    <Sidenav className="flex flex-col h-full" expanded={false}>
      <Sidenav.Body className="flex-grow border-b border-b-[#3c3f43] border-solid flex flex-col h-full">
        {NavBarElementsComp && <NavBarElementsComp />}
      </Sidenav.Body>
      <Sidenav.Body>
        <Nav>
          <Nav.Item
            icon={
              saving ? (
                <WaitIcon spin />
              ) : (
                <FileDownloadIcon color={outDated ? "#3498FF" : undefined} />
              )
            }
            onClick={() => loader.save()}
          >
            Save
          </Nav.Item>
        </Nav>
      </Sidenav.Body>
    </Sidenav>
  );
};
