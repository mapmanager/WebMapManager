import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CustomProvider } from "rsuite";

let element = document.getElementById("main-view") as HTMLElement;
const root = ReactDOM.createRoot(element);

element.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

root.render(
  <CustomProvider theme="dark">
    <App />
  </CustomProvider>
);
