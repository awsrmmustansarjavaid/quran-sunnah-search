import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// The application is intentionally mounted with no backend dependency.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);