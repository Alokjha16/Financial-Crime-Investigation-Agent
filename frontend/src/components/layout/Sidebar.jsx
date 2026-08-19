import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ShieldAlert, FileSearch, ClipboardList, ChevronRight, Plus, Search, Scan, Zap,
} from "lucide-react";
import SystemHealth from "./SystemHealth";
import NewInvestigationModal from "./NewInvestigationModal";
import { api } from "../../services/api";

const NAV = [
  { to: "/",       icon: LayoutDashboard, label: "Dashboard"   },
  { to: "/case/CASE-001", icon: FileSearch,     label: "Investigations" },
  { to: "/audit/CASE-001", icon: ClipboardList,  label: "Audit Trail"  },
  { to: "/demo",   icon: Zap,            label: "Live Demo",  badge: "LIVE" },
];

export default function Sidebar() {
  const location = useLocation();
  const [health, setHealth]     = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Auto-expand if on a case route
  const [scenariosOpen, setScenariosOpen] = useState(() =>
    location.pathname.startsWith("/case/")
  );

  useEffect(() => {
    api.getSystemHealth().then(setHealth);
  }, []);

  // If user navigates to a case, auto-open the dropdown
  useEffect(() => {
    if (location.pathname.startsWith("/case/")) {
      setScenariosOpen(true);
    }
  }, [location.pathname]);

  return (
    <>
      {/* New Investigation Modal */}
      <AnimatePresence>
        {modalOpen && <NewInvestigationModal onClose={() => setModalOpen(false)} />}
      </AnimatePresence>

      <aside className="glass-sidebar w-64 flex flex-col shrink-0 relative z-20">
      {/* Brand */}
      <div className="px-6 py-6" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #7C3AED)' }}
          >
            <ShieldAlert size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none tracking-tight" style={{ color: '#0F172A' }}>FinCrime AI</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: '#94A3B8' }}>IBM AML – SIH 2026</p>
          </div>
        </div>
      </div>

      {/* New Investigation CTA — deliberate command action, not template pill */}
      <div className="px-4 pt-5 pb-2">
        <button
          id="new-investigation-btn"
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center gap-2.5 px-4 py-3 font-bold text-sm transition-all relative overflow-hidden group"
          style={{
            background: "#0F1629",
            color: "#FFFFFF",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.30)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          }}
        >
          {/* Subtle scan sweep animation */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(99,102,241,0.12) 50%, transparent 60%)",
            }}
          />
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative z-10"
            style={{ background: "rgba(99,102,241,0.20)", border: "1px solid rgba(99,102,241,0.35)" }}
          >
            <Search size={14} style={{ color: "#818CF8" }} />
          </div>
          <div className="flex-1 text-left relative z-10">
            <p className="text-sm font-bold leading-none" style={{ color: "#F1F5F9" }}>New Investigation</p>
            <p className="text-[9px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: "#6366F1" }}>
              <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
              AI-powered · autonomous
            </p>
          </div>
          <Plus size={14} className="shrink-0 relative z-10" style={{ color: "#6366F1" }} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-1">
        <p className="section-label px-3 mb-3">Navigation</p>
        {NAV.map(({ to, icon: Icon, label, badge }) => {
          const isActive =
            to === "/" ? location.pathname === "/" : location.pathname.startsWith(to.split("/").slice(0, 2).join("/"));
          const isDemo = to === "/demo";
          return (
            <NavLink
              key={label}
              to={to}
              className={`nav-item ${isActive ? "active" : ""}`}
              style={{
                borderRadius: '12px',
                background: isActive
                  ? isDemo ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(124,58,237,0.12))' : '#EFF6FF'
                  : isDemo ? 'rgba(59,130,246,0.04)' : 'transparent',
                color: isActive ? (isDemo ? '#7C3AED' : '#2563EB') : '#64748B',
                border: isDemo ? '1px solid rgba(124,58,237,0.15)' : 'none',
              }}
            >
              <Icon size={18} style={{ color: isActive ? (isDemo ? '#7C3AED' : '#2563EB') : isDemo ? '#7C3AED' : '#94A3B8' }} />
              <span className={`flex-1 text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
              {badge && (
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(124,58,237,0.15)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}
                >
                  <span className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
                  {badge}
                </span>
              )}
              {isActive && !badge && <ChevronRight size={14} className="opacity-60" style={{ color: '#2563EB' }} />}
            </NavLink>
          );
        })}

        <div className="pt-5">
          {/* Scenarios Dropdown */}
          <button
            onClick={() => setScenariosOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 mb-1 group"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            <p className="section-label" style={{ margin: 0 }}>Scenarios</p>
            <span
              className="transition-transform duration-200"
              style={{
                display: "inline-flex",
                transform: scenariosOpen ? "rotate(90deg)" : "rotate(0deg)",
                color: "#94A3B8"
              }}
            >
              <ChevronRight size={13} />
            </span>
          </button>

          {scenariosOpen && (
            <div style={{ marginTop: "4px" }}>
              {[
                { id: "CASE-001", label: "Money Mule",       risk: "HIGH",   dotColor: "#EF4444" },
                { id: "CASE-002", label: "Acct. Takeover",   risk: "HIGH",   dotColor: "#EF4444" },
                { id: "CASE-003", label: "False Positive",   risk: "LOW",    dotColor: "#10B981" },
                { id: "CASE-004", label: "Structuring",      risk: "MEDIUM", dotColor: "#F97316" },
              ].map(({ id, label, dotColor }) => {
                const isCurrentCase = location.pathname === `/case/${id}`;
                return (
                  <NavLink
                    key={id}
                    to={`/case/${id}`}
                    className="nav-item"
                    style={{
                      borderRadius: '12px',
                      background: isCurrentCase ? '#F5F3FF' : 'transparent',
                      color: isCurrentCase ? '#7C3AED' : '#64748B',
                      fontWeight: isCurrentCase ? 600 : 500,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ background: dotColor }}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {isCurrentCase && <ChevronRight size={14} className="opacity-60" style={{ color: '#7C3AED' }} />}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer — SystemHealth */}
      <SystemHealth health={health} />
    </aside>
    </>
  );
}
