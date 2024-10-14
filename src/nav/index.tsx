import { Sidenav, Nav } from "rsuite";
import FileDownloadIcon from "@rsuite/icons/FileDownload";
import { useState } from "react";
import { PyPixelSource } from "../loaders/py_loader";
import { signal } from "@preact/signals-react";

export let NavBarElements = signal(<></>);

export const MainNavBar = ({ loader }: { loader: PyPixelSource }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Sidenav className="flex flex-col h-full" expanded={expanded}>
      <Sidenav.Body className="flex-grow border-b border-b-[#3c3f43] border-solid flex flex-col h-full">{NavBarElements.value}</Sidenav.Body>
      <Sidenav.Body>
        <Nav>
          <Nav.Item icon={<FileDownloadIcon />} onClick={() => loader.save()}>
            Save
          </Nav.Item>
        </Nav>
      </Sidenav.Body>
      <Sidenav.Toggle onToggle={(expanded) => setExpanded(expanded)} />
    </Sidenav>
  );
};
