import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, FileText, Download } from "lucide-react";
import { api } from "../services/api";
import CaseSummary from "../components/casedetail/CaseSummary";
import CaseLifecycleStepper from "../components/casedetail/CaseLifecycleStepper";
import InvestigationTimeline from "../components/casedetail/InvestigationTimeline";
import NetworkGraph from "../components/casedetail/NetworkGraph";
import EvidencePanel from "../components/casedetail/EvidencePanel";
import ConclusionPanel from "../components/casedetail/ConclusionPanel";
import DecisionUI from "../components/casedetail/DecisionUI";
import TransactionHistory from "../components/casedetail/TransactionHistory";
import KYCPanel from "../components/casedetail/KYCPanel";
import ComplaintsPanel from "../components/casedetail/ComplaintsPanel";
import RiskScoreDrawer from "../components/casedetail/RiskScoreDrawer";

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [network, setNetwork] = useState(null);
  const [txHistory, setTxHistory] = useState([]);
  const [kycData, setKycData] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [riskFactors, setRiskFactors] = useState(null);
  const [structuredEvidence, setStructuredEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setWhyOpen(false);
    Promise.all([
      api.getCase(caseId),
      api.getTimeline(caseId),
      api.getNetwork(caseId),
      api.getTxHistory(caseId),
      api.getKYC(caseId),
      api.getComplaints(caseId),
      api.getRiskFactors(caseId),
      api.getEvidenceStructured(caseId),
    ]).then(([c, t, n, tx, kyc, comp, rf, ev]) => {
      setCaseData(c);
      setTimeline(t);
      setNetwork(n);
      setTxHistory(tx);
      setKycData(kyc);
      setComplaints(comp);
      setRiskFactors(rf);
      setStructuredEvidence(ev);
    }).finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: "rgba(59,130,246,0.25)", borderTopColor: "#3B82F6" }} />
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Loading investigation…</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Case {caseId} was not found.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Why This Score? side-drawer ── */}
      <RiskScoreDrawer
        isOpen={whyOpen}
        riskData={riskFactors}
        caseData={caseData}
        onClose={() => setWhyOpen(false)}
      />

      <div className="space-y-5 page-enter max-w-[1400px]">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "#64748B" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#0F172A"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#64748B"}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* View Full Report — stub */}
            <button
              disabled
              title="Coming soon — backend required"
              className="flex items-center gap-2 btn-ghost opacity-50 cursor-not-allowed"
            >
              <FileText size={15} /> View Full Report
            </button>

            {/* Export PDF — stub */}
            <button
              disabled
              title="Coming soon — backend required"
              className="flex items-center gap-2 btn-ghost opacity-50 cursor-not-allowed"
            >
              <Download size={15} /> Export PDF
            </button>

            <button
              onClick={() => navigate(`/audit/${caseId}`)}
              className="flex items-center gap-2 btn-ghost"
            >
              <ClipboardList size={15} /> View Audit Trail
            </button>
          </div>
        </div>

        {/* Lifecycle stepper */}
        <CaseLifecycleStepper caseData={caseData} />

        {/* Case summary — "Why this score?" button triggers drawer */}
        <CaseSummary caseData={caseData} onWhyScore={() => setWhyOpen(true)} />

        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Left column */}
          <div className="space-y-5">
            <InvestigationTimeline steps={timeline} />
            <TransactionHistory txHistory={txHistory} currentTxnId={caseData.transaction_id} />
            {/* Structured evidence — passes both prop types for fallback safety */}
            <EvidencePanel
              evidence={caseData.evidence}
              structuredEvidence={structuredEvidence}
            />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <NetworkGraph networkData={network} kycData={kycData} />
            <KYCPanel kycData={kycData} />
            <ComplaintsPanel complaints={complaints} />
            <ConclusionPanel caseData={caseData} />
            <DecisionUI
              caseData={caseData}
              onDecisionMade={(decision) =>
                setCaseData((prev) => ({
                  ...prev,
                  decision,
                  status:
                    decision === "CLEAR" ? "CLEARED"
                      : decision === "ESCALATE" ? "ESCALATED"
                        : decision === "FALSE_POSITIVE" ? "CLEARED"
                          : prev.status,
                }))
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
