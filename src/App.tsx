import React from "react";
import "./App.scss";
import "rsuite/dist/rsuite-no-reset.min.css";
import { useImageLoader } from "./components/utils";
import Layout from "./components/layout";
import { CustomProvider } from "rsuite";

function App() {
  const { loader, loading, error } = useImageLoader("/api/data/rr30a_s0/");
  if (loading) return <h1>loading</h1>;
  if (error) return <h1>{error.message}</h1>;
  return (
    <CustomProvider theme="dark">
      <Layout loader={loader!} />;
    </CustomProvider>
  );
}

export default App;
