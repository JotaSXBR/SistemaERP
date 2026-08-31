import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { DiagnosticsPage } from "../pages/diagnostics-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { AppLayout } from "./app-layout.js";
import { GlobalErrorBoundary } from "./global-error-boundary.js";

export function App() {
  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route element={<Navigate replace to="/diagnostics" />} index />
            <Route element={<DiagnosticsPage />} path="diagnostics" />
            <Route element={<NotFoundPage />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  );
}
