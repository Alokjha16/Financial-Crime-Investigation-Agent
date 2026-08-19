import { useEffect, useState } from "react";
import { api } from "../services/api";
import StatsCards         from "../components/dashboard/StatsCards";
import RiskDonut          from "../components/dashboard/RiskDonut";
import CaseTable          from "../components/dashboard/CaseTable";
import AgentActivity      from "../components/dashboard/AgentActivity";
import RecentEscalations  from "../components/dashboard/RecentEscalations";

export default function DashboardPage() {
  const [stats,        setStats]        = useState(null);
  const [cases,        setCases]        = useState([]);
  const [activity,     setActivity]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    Promise.all([api.getStats(), api.getCases(), api.getAgentActivity()])
      .then(([s, c, a]) => { setStats(s); setCases(c); setActivity(a); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div
            className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: "rgba(59,130,246,0.25)", borderTopColor: "#3B82F6" }}
          />
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Loading investigation data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-[1400px]" style={{ display: "flex", flexDirection: "column", gap: 36 }}>

      {/* ── Zone 1: KPI cards ── */}
      <StatsCards
        stats={stats}
        onCardClick={(filterKey) =>
          setActiveFilter((prev) => (prev === filterKey ? null : filterKey))
        }
      />

      {/* ── Zone 2: Risk charts + Escalations (tighter internal gap) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
        <RiskDonut stats={stats} />
        <RecentEscalations cases={cases} />
      </div>

      {/* ── Zone 3: Cases table — command center core ── */}
      <CaseTable cases={cases} externalFilter={activeFilter} />

      {/* ── Zone 4: Agent Activity — full-width hero feed ── */}
      <AgentActivity activities={activity} />

    </div>
  );
}
