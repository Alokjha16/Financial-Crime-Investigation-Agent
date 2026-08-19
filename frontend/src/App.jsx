import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import DashboardPage from "./pages/DashboardPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import AuditTrailPage from "./pages/AuditTrailPage";
import LiveInvestigationPage from "./pages/LiveInvestigationPage";
import AMLDemoPage from "./pages/AMLDemoPage";
import ToastContainer from "./components/ui/Toast";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        {/* Toast container (global) */}
        <ToastContainer />
        {/* Subtle dot-grid texture */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="bg-grid absolute inset-0 opacity-60" />
        </div>

        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden relative z-10">
          <Header />
          <main className="flex-1 overflow-y-auto px-8 py-7">
            <Routes>
              <Route path="/"              element={<DashboardPage />} />
              <Route path="/case/:caseId"  element={<CaseDetailPage />} />
              <Route path="/audit/:caseId" element={<AuditTrailPage />} />
              <Route path="/live/:caseId"  element={<LiveInvestigationPage />} />
              <Route path="/demo"           element={<AMLDemoPage />} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
