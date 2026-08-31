import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app.js";
import { AppProviders } from "./app/app-providers.js";
import "./styles.css";

const rootElement = document.querySelector<HTMLDivElement>("#root");

if (!rootElement) {
  throw new Error("Application root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
