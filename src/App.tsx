import React from "react";
import "./App.scss";
import "rsuite/dist/rsuite-no-reset.min.css";
import Layout from "./components/layout";
import { CustomProvider } from "rsuite";
import { dataChanged } from "./components/plugins/globals";
import "@preact/signals-react/auto";

const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    if (event.shiftKey) window.loaderSignal.peek().redo();
    else window.loaderSignal.peek().undo();

    dataChanged();
    event.preventDefault();
  }
};

document.addEventListener("keydown", handleKeyDown);

export default function App() {
  const loader = window.loaderSignal.value;

  return (
    <CustomProvider theme="dark">
      <Layout loader={loader} />
    </CustomProvider>
  );
}
