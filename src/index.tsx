import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

let element = document.getElementById("main-view") as HTMLElement
const root = ReactDOM.createRoot(
  element
);

element.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

root.render(<App />);