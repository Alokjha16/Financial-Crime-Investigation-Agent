import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, User, ChevronDown, LogOut, Activity, UserCircle } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import NotificationPanel from "./NotificationPanel";
import { MOCK_NOTIFICATIONS } from "../../data/mockData";

const PAGE_TITLES = {
  "/": { title: "Analyst Dashboard", subtitle: "Autonomous Financial Crime Investigation Agent" },
};

export default function Header() {
  const location = useLocation();
  const info = PAGE_TITLES[location.pathname] || { title: "Investigation", subtitle: "Autonomous financial crime analysis" };

  const [searchOpen, setSearchOpen]     = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const profileRef = useRef(null);
  const bellRef    = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close profile on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Global keyboard: Ctrl+K or / opens search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleMarkAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const handleDismiss = (id) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <>
      {/* ── Global Search Modal ── */}
      <AnimatePresence>
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>

      {/* ── Header Bar ── */}
      <header
        className="shrink-0 px-6 py-4 flex items-center gap-4 relative z-30"
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 1px 0 rgba(15,23,42,0.06)",
        }}
      >
        {/* Title */}
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-none" style={{ color: "#0F172A" }}>{info.title}</h1>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{info.subtitle}</p>
        </div>

        {/* Search trigger */}
        <div
          className="relative hidden md:flex items-center gap-2 cursor-pointer"
          onClick={() => setSearchOpen(true)}
        >
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
            <div
              className="pl-9 pr-4 py-2 rounded-xl text-sm w-64 select-none"
              style={{
                background: "#F5F6FA",
                border: "1px solid rgba(15,23,42,0.08)",
                color: "#94A3B8",
              }}
            >
              Search cases, accounts…
            </div>
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: "#E8EAF0", color: "#94A3B8", border: "1px solid rgba(15,23,42,0.09)" }}
            >
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Notification bell */}
        <div className="relative" ref={bellRef}>
          <button
            id="notification-bell"
            className="relative p-2.5 rounded-xl transition-colors"
            style={{ background: "#F5F6FA", border: "1px solid rgba(15,23,42,0.08)" }}
            onClick={() => { setNotifOpen((o) => !o); setProfileOpen(false); }}
            aria-label="Notifications"
          >
            <Bell size={17} style={{ color: "#64748B" }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: "#EF4444" }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <NotificationPanel
                notifications={notifications}
                onClose={() => setNotifOpen(false)}
                onMarkAllRead={handleMarkAllRead}
                onDismiss={handleDismiss}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Analyst profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            id="analyst-profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
            style={{ background: "#F5F6FA", border: "1px solid rgba(15,23,42,0.08)" }}
            onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
            aria-expanded={profileOpen}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}
            >
              <User size={14} className="text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-none" style={{ color: "#0F172A" }}>Analyst</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>Senior Investigator</p>
            </div>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              style={{ color: "#94A3B8" }}
            />
          </button>

          {/* Profile dropdown */}
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(15,23,42,0.08)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                  <p className="text-xs font-bold" style={{ color: "#0F172A" }}>Analyst Priya S.</p>
                  <p className="text-[11px]" style={{ color: "#94A3B8" }}>priya@fincrime.ai</p>
                </div>
                {[
                  { icon: UserCircle, label: "Profile"  },
                  { icon: Activity,   label: "Activity" },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left"
                    style={{ color: "#334155" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F5F6FA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Icon size={15} style={{ color: "#94A3B8" }} />
                    {label}
                  </button>
                ))}
                <div style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left"
                    style={{ color: "#EF4444" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#FFF5F5"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <LogOut size={15} style={{ color: "#EF4444" }} />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </>
  );
}
