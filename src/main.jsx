import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles.css";

/*
 * ============================================================
 * NUR SEARCH — REACT APPLICATION ENTRY POINT
 * ============================================================
 *
 * This file is the starting point of the React application.
 *
 * Its main responsibilities are:
 *
 * - Import React.
 * - Import ReactDOM.
 * - Import the main App component.
 * - Import the application's global CSS.
 * - Find the HTML element where React should mount.
 * - Render the App component.
 *
 * The application is frontend-only and does not require its own
 * backend server.
 */


/*
 * ============================================================
 * REACT ROOT
 * ============================================================
 *
 * index.html contains:
 *
 *     <div id="root"></div>
 *
 * React uses this element as the mounting point for the entire
 * single-page application.
 *
 * createRoot() is the modern React API used to create a React
 * rendering root.
 */
const root = ReactDOM.createRoot(
  document.getElementById("root")
);


/*
 * ============================================================
 * APPLICATION RENDERING
 * ============================================================
 *
 * React.StrictMode enables additional development-time checks.
 *
 * It helps identify:
 *
 * - Unsafe React patterns.
 * - Deprecated APIs.
 * - Unexpected side effects.
 * - Components that may have problems with future React versions.
 *
 * StrictMode only affects development behavior.
 * It does not add visible UI to the application.
 */
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

