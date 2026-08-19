import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  useReactFlow, ReactFlowProvider,
  Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  X, RotateCcw, Building2, User, ShieldAlert, ShieldCheck,
  Calendar, CreditCard, ArrowRightLeft, AlertTriangle, CheckCircle2
} from "lucide-react";
import { fmtINR } from "../../utils/format";

// ── Style maps ────────────────────────────────────────────────
const NODE_STYLES = {
  sender:  { bg: "rgba(59,130,246,0.10)",  border: "#3B82F6", text: "#1D4ED8",  label: "Sender / Originator" },
  mule:    { bg: "rgba(239,68,68,0.10)",   border: "#EF4444", text: "#B91C1C",  label: "Receiver / Mule"     },
  linked:  { bg: "rgba(139,92,246,0.10)", border: "#8B5CF6", text: "#6D28D9",  label: "Linked Counterparty" },
  feeder:  { bg: "rgba(249,115,22,0.10)", border: "#F97316", text: "#C2410C",  label: "Feeder Account"      },
};

const LEGEND_ITEMS = [
  { type: "sender", label: "Sender"          },
  { type: "mule",   label: "Receiver / Mule" },
  { type: "linked", label: "Linked Account"  },
  { type: "feeder", label: "Feeder Account"  },
];

// ── Custom node ───────────────────────────────────────────────
function CustomNode({ data, selected }) {
  const s = NODE_STYLES[data.type] || NODE_STYLES.linked;
  const lines = (data.label || "").split("\n");
  return (
    <div
      className="px-3.5 py-2.5 rounded-xl text-center cursor-pointer transition-all"
      style={{
        background: selected ? s.border : "#FFFFFF",
        border: `2px solid ${s.border}`,
        boxShadow: selected
          ? `0 0 0 3px ${s.border}44, 0 4px 14px rgba(0,0,0,0.10)`
          : "0 4px 14px rgba(0,0,0,0.06)",
        minWidth: 100,
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: s.border, border: "2px solid #FFFFFF", width: 9, height: 9 }} />
      <p className="text-xs font-bold font-mono" style={{ color: selected ? "#FFFFFF" : s.text }}>{lines[0]}</p>
      {lines[1] && <p className="text-[10px] font-semibold mt-0.5" style={{ color: selected ? "rgba(255,255,255,0.9)" : "#64748B" }}>{lines[1]}</p>}
      <Handle type="source" position={Position.Right}
        style={{ background: s.border, border: "2px solid #FFFFFF", width: 9, height: 9 }} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

// ── Inner graph (needs ReactFlowProvider wrapper for useReactFlow) ──
function GraphInner({ networkData, onNodeClick, onEdgeClick }) {
  const { fitView } = useReactFlow();

  const initialNodes = useMemo(() => {
    const raw = networkData?.nodes || [];
    return raw.map((n, i) => {
      if (n.position && typeof n.position.x === "number") return n;
      const total = Math.max(raw.length, 1);
      const angle = (i / total) * 2 * Math.PI;
      const radius = total === 1 ? 0 : 160;
      const x = Math.round(350 + radius * Math.cos(angle));
      const y = Math.round(180 + radius * Math.sin(angle));
      const nodeType = n.type || "linked";
      const label = n.label || n.data?.label || n.id;
      return {
        id: n.id,
        type: "custom",
        position: { x, y },
        data: {
          label,
          type: nodeType === "primary" ? "sender" : nodeType === "cycle" ? "mule" : nodeType,
          ...n.data,
        },
      };
    });
  }, [networkData]);

  const initialEdges = useMemo(() => (networkData?.edges || []).map((e, idx) => ({
    id: e.id || `e-${e.source}-${e.target}-${idx}`,
    ...e,
    style: {
      stroke: e.data?.suspicious || e.suspicious ? "#EF4444" : "rgba(59,130,246,0.55)",
      strokeWidth: e.data?.suspicious || e.suspicious ? 2.5 : 2,
      strokeDasharray: e.data?.suspicious || e.suspicious ? "5 3" : undefined,
    },
    labelStyle: { fill: "#475569", fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "rgba(248,250,255,0.95)", stroke: "rgba(59,130,246,0.2)", strokeWidth: 1 },
  })), [networkData]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <>
      {/* Reset button */}
      <button
        onClick={() => fitView({ padding: 0.3, duration: 400 })}
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.10)", color: "#64748B", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        title="Reset view"
      >
        <RotateCcw size={12} /> Reset
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node)}
        onEdgeClick={(_, edge) => onEdgeClick(edge)}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(15,23,42,0.05)" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          style={{ background: "#F8FAFF", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12 }}
          nodeColor={(n) => (NODE_STYLES[n.data?.type] || NODE_STYLES.linked).border}
        />
      </ReactFlow>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function NetworkGraph({ networkData, kycData }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  const summary = networkData?.summary || {};

  const handleNodeClick = useCallback((node) => {
    setSelectedEdge(null);
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleEdgeClick = useCallback((edge) => {
    setSelectedNode(null);
    setSelectedEdge((prev) => (prev?.id === edge.id ? null : edge));
  }, []);

  if (!networkData || !networkData.nodes?.length) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="glass-card p-6 flex items-center justify-center h-64">
        <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>No linked-account relationships found</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold" style={{ color: "#0F172A" }}>Account Network Graph</p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Click any node or connection edge to inspect full account details</p>
          </div>
          {/* Summary counts */}
          <div className="flex items-center gap-3">
            {[
              { label: "Senders",  value: summary.senders,  color: "#3B82F6" },
              { label: "Mules",    value: summary.mules,    color: "#EF4444" },
              { label: "Linked",   value: summary.linked,   color: "#8B5CF6" },
              { label: "Feeders",  value: summary.feeders,  color: "#F97316" },
            ].filter((s) => s.value > 0).map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-base font-black leading-none" style={{ color }}>{value}</p>
                <p className="text-[9px] font-semibold mt-0.5" style={{ color: "#94A3B8" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4">
          {LEGEND_ITEMS.map(({ type, label }) => {
            const s = NODE_STYLES[type];
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: s.bg, border: `1.5px solid ${s.border}` }} />
                <span className="text-[10px] font-semibold" style={{ color: "#64748B" }}>{label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 rounded-full" style={{ background: "#EF4444", borderTop: "2px dashed #EF4444" }} />
            <span className="text-[10px] font-semibold" style={{ color: "#64748B" }}>Suspicious Flow</span>
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="relative" style={{ height: 320 }}>
        <ReactFlowProvider>
          <GraphInner
            networkData={networkData}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
          />
        </ReactFlowProvider>
      </div>

      {/* ── Node / Edge Rich Detail Drawer ── */}
      <AnimatePresence>
        {(selectedNode || selectedEdge) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderTop: "1px solid rgba(15,23,42,0.08)", background: "#FAFBFD" }}
          >
            <div className="px-6 py-5">
              {/* If Node is selected */}
              {selectedNode && (() => {
                const d = selectedNode.data || {};
                const s = NODE_STYLES[d.type] || NODE_STYLES.linked;

                return (
                  <div className="space-y-4">
                    {/* Top Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ background: s.bg, color: s.text, border: `1.5px solid ${s.border}` }}>
                          {d.type === "sender" ? <Building2 size={15} /> : d.type === "mule" ? <ShieldAlert size={15} /> : <User size={15} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-slate-900">{d.account_id || selectedNode.id}</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                              {s.label}
                            </span>
                            {d.risk && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: d.risk === "HIGH" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)", color: d.risk === "HIGH" ? "#EF4444" : "#2563EB" }}>
                                {d.risk} Risk
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{d.holder || "Authorized Entity Profile"}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedNode(null)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Detailed Attribute Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Institution & Bank</p>
                        <p className="font-bold text-slate-800">{d.bank || "Interbank Clearing House"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Account Maturity</p>
                        <p className="font-bold text-slate-800">{d.account_age || (kycData?.account_id === selectedNode.id ? kycData.account_age_label : "14 Months")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">KYC Verification</p>
                        <p className="font-bold" style={{ color: (d.kyc_status || kycData?.kyc_status) === "COMPLETE" ? "#10B981" : "#EF4444" }}>
                          {d.kyc_status || (kycData?.account_id === selectedNode.id ? kycData.kyc_status : "INCOMPLETE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Volume / Flow</p>
                        <p className="font-bold text-indigo-700">{d.balance || "$148,500 Flow"}</p>
                      </div>
                    </div>

                    {/* Node Behavioral Rationale / Topology Flags */}
                    {d.flags && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/70 text-xs flex items-start gap-2 text-amber-900">
                        <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                        <span><strong>Graph Analysis Flag:</strong> {d.flags}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* If Edge is selected */}
              {selectedEdge && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: selectedEdge.data?.suspicious ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)" }}>
                        <ArrowRightLeft size={15} style={{ color: selectedEdge.data?.suspicious ? "#EF4444" : "#3B82F6" }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black uppercase text-slate-900">Transaction Transfer Link</p>
                          {selectedEdge.data?.suspicious && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                              SUSPICIOUS AML FLOW
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          {selectedEdge.source} ➔ {selectedEdge.target}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedEdge(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transfer Flow</p>
                      <p className="font-bold text-slate-900">
                        {selectedEdge.data?.amount ? `$${Number(selectedEdge.data.amount).toLocaleString()}` : selectedEdge.label || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Link Classification</p>
                      <p className="font-bold" style={{ color: selectedEdge.data?.suspicious ? "#EF4444" : "#10B981" }}>
                        {selectedEdge.data?.suspicious ? "Layering Hop" : "Standard Counterparty"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direction</p>
                      <p className="font-bold text-slate-900">Outbound Disbursement</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
