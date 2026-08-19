import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Filter, Search } from "lucide-react";
import { fmtINR } from "../../utils/format";

const FILTERS = ["ALL", "FLAGGED", "HIGH", "ESCALATED", "CLEARED", "UNDER_REVIEW"];



const StatusBadge = ({ status, risk }) => {
  const map = {
    ESCALATED:    "badge-escalated",
    CLEARED:      "badge-cleared",
    FLAGGED:      "badge-flagged",
    UNDER_REVIEW: "badge-review",
  };
  const riskMap = { HIGH: "badge-high", MEDIUM: "badge-medium", LOW: "badge-low" };
  return (
    <div className="flex items-center gap-1.5">
      <span className={map[status] || "badge-review"}>{status.replace("_", " ")}</span>
      <span className={riskMap[risk] || "badge-low"}>{risk}</span>
    </div>
  );
};

const TypologyBadge = ({ t }) => {
  const colors = {
    MONEY_MULE:      { bg: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "rgba(124,58,237,0.22)" },
    ACCOUNT_TAKEOVER:{ bg: "rgba(239,68,68,0.10)",  color: "#EF4444", border: "rgba(239,68,68,0.22)" },
    FALSE_POSITIVE:  { bg: "rgba(16,185,129,0.10)", color: "#10B981", border: "rgba(16,185,129,0.22)" },
    STRUCTURING:     { bg: "rgba(249,115,22,0.10)", color: "#F97316", border: "rgba(249,115,22,0.22)" },
  };
  const s = colors[t] || colors.STRUCTURING;
  return (
    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {t?.replace("_", " ")}
    </span>
  );
};

export default function CaseTable({ cases, externalFilter }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Sync externalFilter from KPI card clicks
  useEffect(() => {
    if (externalFilter) setFilter(externalFilter);
  }, [externalFilter]);

  const filtered = (cases || []).filter((c) => {
    const matchFilter =
      filter === "ALL"          ? true :
      filter === "HIGH"         ? c.risk_level === "HIGH" :
      c.status === filter;
    const matchSearch = !search || c.case_id.includes(search.toUpperCase()) ||
      c.from_account.includes(search.toUpperCase()) || c.to_account.includes(search.toUpperCase());
    return matchFilter && matchSearch;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="glass-card overflow-hidden">
      {/* Table header */}
      <div className="px-6 py-4 flex flex-wrap items-center gap-3"
        style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
        <div>
          <p className="text-sm font-bold" style={{ color: '#0F172A' }}>Investigation Cases</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>{filtered.length} of {cases?.length || 0} cases</p>
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case / account…"
            className="pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none w-52 transition-colors focus:border-blue-400"
            style={{ background: '#F5F6FA', border: '1px solid rgba(15,23,42,0.08)', color: '#1E293B' }} />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={13} style={{ color: '#94A3B8' }} />
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs px-3 py-1 rounded-xl font-semibold transition-all duration-150"
              style={{
                background: filter === f ? '#EFF6FF' : 'rgba(15,23,42,0.03)',
                color:      filter === f ? '#2563EB' : '#64748B',
                border:     filter === f ? '1px solid rgba(59,130,246,0.30)' : '1px solid rgba(15,23,42,0.06)',
              }}>
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: '#FAFBFD' }}>
              {["Case ID", "Transaction", "Amount", "Status / Risk", "Typology", "Date", ""].map((h) => (
                <th key={h} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: '#94A3B8' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((c, i) => (
                <motion.tr key={c.case_id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/case/${c.case_id}`)}
                  className="cursor-pointer group transition-colors"
                  style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-6 py-5">
                    <span className="font-mono text-xs font-bold" style={{ color: '#2563EB' }}>{c.case_id}</span>
                  </td>
                  <td className="px-6 py-5 text-xs" style={{ color: '#475569' }}>
                    <span className="font-mono font-medium">{c.from_account}</span>
                    <span className="mx-1.5" style={{ color: '#CBD5E1' }}>→</span>
                    <span className="font-mono font-medium">{c.to_account}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-black text-sm" style={{ color: '#0F172A' }}>{fmtINR(c.amount)}</span>
                    <span className="text-xs ml-1 font-bold" style={{ color: '#94A3B8' }}>{c.currency}</span>
                  </td>
                  {/* Status/Risk — extra right padding to breathe away from Typology */}
                  <td className="pl-6 pr-10 py-5">
                    <StatusBadge status={c.status} risk={c.risk_level} />
                  </td>
                  <td className="px-6 py-5">
                    <TypologyBadge t={c.typology} />
                  </td>
                  <td className="px-6 py-5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-6 py-5">
                    <ArrowUpRight size={16} style={{ color: '#CBD5E1' }}
                      className="group-hover:text-blue-600 transition-colors" />
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-sm font-medium" style={{ color: '#94A3B8' }}>No cases match the current filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
