import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Prompts from "./Prompts.jsx";
import { installStorage } from "./storage.js";

/* App.jsx expects window.storage to exist before it mounts. */
installStorage();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Prompts />
  </React.StrictMode>
);
