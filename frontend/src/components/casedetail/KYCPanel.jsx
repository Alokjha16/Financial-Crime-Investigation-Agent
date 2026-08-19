import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Clock, Building, User, Calendar, AlertCircle } from "lucide-react";

const KYC_STATUS_CONFIG = {
  COMPLETE:   { icon: ShieldCheck, color: "#10B981", bg: "rgba(16,185,129,0.10)",  label: "Complete"   },
  INCOMPLETE: { icon: ShieldAlert, color: "#EF4444", bg: "rgba(239,68,68,0.10)",   label: "Incomplete" },
  PARTIAL:    { icon: Clock,       color: "#F59E0B", bg: "rgba(245,158,11,0.10)",   label: "Partial"    },
};

export default function KYCPanel({ kycData }) {
  if (!kycData) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card p-6 flex items-center justify-center h-32">
        <p className="text-sm" style={{ color: "#94A3B8" }}>No KYC data available</p>
      </motion.div>
    );
  }

  const kycCfg = KYC_STATUS_CONFIG[kycData.kyc_status] || KYC_STATUS_CONFIG.INCOMPLETE;
  const KycIcon = kycCfg.icon;

  const fields = [
    { icon: User,     label: "Account",             value: kycData.account_id                  },
    { icon: Calendar, label: "Account Age",          value: kycData.account_age_label           },
    { icon: KycIcon,  label: "KYC Status",           value: kycData.kyc_status                  },
    { icon: Building, label: "Account Type",         value: kycData.account_type                },
    { icon: ShieldCheck, label: "Business Verification", value: kycData.business_verification   },
    { icon: Calendar, label: "Last KYC Update",      value: kycData.last_kyc_update || "Never"  },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
        <div>
          <p className="text-sm font-semibold leading-none" style={{ color: "#0F172A" }}>KYC & Account Profile</p>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Account: {kycData.account_id}</p>
        </div>
        {/* KYC status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: kycCfg.bg, border: `1px solid ${kycCfg.color}33` }}>
          <KycIcon size={13} style={{ color: kycCfg.color }} />
          <span className="text-xs font-bold" style={{ color: kycCfg.color }}>{kycCfg.label}</span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Fields grid */}
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ icon: Icon, label, value }) => {
            const isBad =
              (label === "KYC Status" && kycData.kyc_status !== "COMPLETE") ||
              (label === "Account Age" && kycData.account_age_days < 30) ||
              (label === "Business Verification" && value === "Not Available");

            return (
              <div key={label} className="p-3 rounded-xl" style={{ background: "#F8FAFF", border: "1px solid rgba(15,23,42,0.06)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "#94A3B8" }}>
                  <Icon size={10} />
                  {label}
                </p>
                <p className="text-xs font-bold" style={{ color: isBad ? "#EF4444" : "#0F172A" }}>
                  {value}
                  {isBad && " ⚠"}
                </p>
              </div>
            );
          })}
        </div>

        {/* Risk indicators */}
        {kycData.risk_indicators && kycData.risk_indicators.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#94A3B8" }}>
              <AlertCircle size={10} />
              Risk Indicators
            </p>
            <div className="space-y-1.5">
              {kycData.risk_indicators.map((indicator, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <span className="text-xs mt-0.5" style={{ color: "#EF4444" }}>•</span>
                  <p className="text-xs" style={{ color: "#334155" }}>{indicator}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {kycData.risk_indicators && kycData.risk_indicators.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-3 rounded-xl"
            style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <ShieldCheck size={14} style={{ color: "#10B981" }} />
            <p className="text-xs font-semibold" style={{ color: "#059669" }}>No risk indicators — account in good standing</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
