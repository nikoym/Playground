import { useEffect, useState } from "react";
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { CaptureSheet } from "./components/sheets";
import { SyncBadge, ToastView } from "./components/ui";
import { daysUntilScorable } from "./domain/cooldown";
import { ArchivePage } from "./pages/Archive";
import { CommitPage } from "./pages/Commit";
import { FocusPage } from "./pages/Focus";
import { IdeaDetailPage } from "./pages/IdeaDetail";
import { InboxPage } from "./pages/Inbox";
import { RankedPage } from "./pages/Ranked";
import { SettingsPage } from "./pages/Settings";
import { StoreProvider, useStore } from "./state/store";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const { data } = useStore();
  const [capturing, setCapturing] = useState(false);
  const now = new Date();
  const readyToScore = data.ideas.filter((i) => i.status === "inbox" && daysUntilScorable(i, data.settings, now) === 0).length;

  // Keyboard shortcut: "n" opens capture (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        setCapturing(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const tabs = [
    { to: "/", label: "Focus", icon: "🎯", end: true },
    { to: "/inbox", label: "Inbox", icon: "📥", count: readyToScore },
    { to: "/ranked", label: "Ranked", icon: "🏆" },
    { to: "/archive", label: "Archive", icon: "🗂️" },
    { to: "/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="app">
      <ScrollToTop />
      <header className="topbar">
        <Link to="/" className="brand">💡 Idea Tracker</Link>
        <nav className="tabs" aria-label="Main">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              <span className="icon" aria-hidden="true">{t.icon}</span>
              <span>
                {t.label}
                {t.count ? <span className="count" aria-label={`${t.count} ready`}>{t.count}</span> : null}
              </span>
            </NavLink>
          ))}
        </nav>
        <SyncBadge />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<FocusPage />} />
          <Route path="/inbox" element={<InboxPage onCapture={() => setCapturing(true)} />} />
          <Route path="/ranked" element={<RankedPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/idea/:id" element={<IdeaDetailPage />} />
          <Route path="/idea/:id/commit" element={<CommitPage />} />
          <Route path="*" element={<div className="empty-state">Page not found. <Link to="/">Go home</Link></div>} />
        </Routes>
      </main>
      <button className="fab" aria-label="Capture idea (n)" title="Capture idea (n)" onClick={() => setCapturing(true)}>+</button>
      {capturing && <CaptureSheet onClose={() => setCapturing(false)} />}
      <ToastView />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
