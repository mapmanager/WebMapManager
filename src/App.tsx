import React, { useEffect, useState } from "react";
import "./App.scss";
import "rsuite/dist/rsuite-no-reset.min.css";
import { ImageSource, useImageLoader } from "./components/utils";
import Layout from "./components/layout";
import { Button, CustomProvider, Form, Loader } from "rsuite";
import { dataChanged } from "./components/plugins/globals";
import { useDropzone } from "react-dropzone";
import "@preact/signals-react/auto";

interface Props {
  file: ImageSource;
}

function App({ file }: Props) {
  const { loader, loading, error } = useImageLoader(file);
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

  if (loading)
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <Loader size="lg" content="Loading File" />
      </div>
    );
  if (error) return <h1>{error.message}</h1>;
  return <Layout loader={loader!} />;
}

function Loading() {
  const [file, setFile] = useState<ImageSource | undefined>(undefined);
  if (file)
    return (
      <CustomProvider theme="dark">
        {/* <LoadFiles setFile={setFile} file={file} background /> */}
        <App file={file} />
      </CustomProvider>
    );

  return (
    <CustomProvider theme="dark">
      <div className="loading-file">
        <LoadFiles setFile={setFile} file={file} />
      </div>
    </CustomProvider>
  );
}

function LoadFiles({
  setFile,
  file,
  background,
}: {
  setFile: (file: ImageSource) => void;
  file: ImageSource | undefined;
  background?: boolean;
}) {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop(acceptedFiles, fileRejections, event) {
      for (const file of acceptedFiles) {
        if (!file.name.endsWith(".mmap")) {
          alert("Invalid file type. Please upload a '.mmap' file.");
          return;
        }

        setFile(file);
      }
    },
  });

  if (background) {
    return (
      <Form layout="inline" onSubmit={({ url }: any) => setFile(url)}>
        <div
          {...getRootProps({
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
          })}
        >
          <input {...getInputProps()} />
        </div>
      </Form>
    );
  }

  return (
    <div className="loading-container">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1em",
        }}
      >
        <Form layout="inline" onSubmit={({ url }: any) => setFile(url)}>
          <Form.Group controlId="url">
            <Form.ControlLabel>
              Load a '.mmap' file from a URL:
            </Form.ControlLabel>
            <Form.Control placeholder="url" name="url" type="url" />
          </Form.Group>

          <Button type="submit">Submit</Button>
        </Form>
      </div>
      <div
        {...getRootProps({
          style: {
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            display: "flex",
            padding: "1em",
          },
        })}
      >
        <input {...getInputProps()} />
        <div>
          <p>
            <u>Open</u> or Drag 'n' drop a '.mmap' files here.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Loading;
