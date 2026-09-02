import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { DiagnosticsPage } from "../pages/diagnostics-page.js";
import { FiscalIntakePage } from "../pages/fiscal-intake-page.js";
import { LoginPage } from "../pages/login-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { OrganizationPage } from "../pages/organization-page.js";
import { AppLayout } from "./app-layout.js";
import { GlobalErrorBoundary } from "./global-error-boundary.js";
import { RequireSession } from "./require-session.js";

export function App() {
  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<LoginPage />} path="login" />
          <Route element={<AppLayout />}>
            <Route element={<Navigate replace to="/diagnostics" />} index />
            <Route element={<DiagnosticsPage />} path="diagnostics" />
            <Route element={<RequireSession />}>
              <Route element={<FiscalIntakePage />} path="fiscal-intake" />
              <Route element={<OrganizationPage />} path="organization" />
            </Route>
            <Route element={<NotFoundPage />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  );
}
