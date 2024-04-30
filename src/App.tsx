import React, { useEffect } from "react";
import "./App.scss";
import "rsuite/dist/rsuite-no-reset.min.css";
import { useImageLoader } from "./components/utils";
import Layout from "./components/layout";
import { CustomProvider } from "rsuite";
import { dataChanged } from "./components/plugins/globals";

function App() {
  const { loader, loading, error } = useImageLoader("/api/data/rr30a_s0u.mmap");
  useEffect(() => {
    if (!loader) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        if (event.shiftKey) loader.redo();
        else loader.undo();

        dataChanged();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [loader]);

  if (loading) return <h1>loading</h1>;
  if (error) return <h1>{error.message}</h1>;

  return (
    <CustomProvider theme="dark">
      <Layout loader={loader!} />;
    </CustomProvider>
  );
}

export default App;
