"use client";
import LocalizedDate from "./localized-date";
import { usePhoneBack } from "./use-phone-back";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import { RequestError } from "./eso-shared";
import {
  CheckCheck as ActionCheckCheck,
  X as ActionX,
  KeyRound as ActionKeyRound,
} from "lucide-react";
import { VoESubmit, VoEList } from "@/components/voe";
import Login, { PasswordInput } from "@/components/login";
import MobileQuickNav from "./mobile-quick-nav";
export { default as MobileQuickNav } from "./mobile-quick-nav";
import SiteFooter from "@/components/site-footer";
import {resetPageScroll} from "./page-scroll-reset";
import BrandWordmark from "@/components/brand-wordmark";
import LoadingStatus from "@/components/loading-status";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileText,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Users,
  Wrench,
  X,
  Trophy,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";
import type {
  AppNotification,
  Department,
  ESOReport,
  Location,
  Plant,
  User,
  VoEReport,
} from "@/types";
import { ReportEntry, TaskWorkspace } from "@/components/eso-workflow";
import { LanguageControl } from "@/components/i18n";
import { json, Title, canAdmin, canMaintain, canViewAll } from "./eso-shared";
import { Dashboard, TrackingData, DashboardSummary } from "./eso-dashboard";
import { ReportsTable, ReportModal } from "./eso-reports";
const loading = () => <LoadingStatus />;
const Employees = dynamic(
  () => import("./eso-administration").then((m) => m.Employees),
  { loading },
);
const Departments = dynamic(
  () => import("./eso-administration").then((m) => m.Departments),
  { loading },
);
const Locations = dynamic(
  () => import("./eso-administration").then((m) => m.Locations),
  { loading },
);
const Plants = dynamic(
  () => import("./eso-administration").then((m) => m.Plants),
  { loading },
);
const Exports = dynamic(() => import("./eso-exports").then((m) => m.Exports), {
  loading,
});
const HuntView = dynamic(() => import("./eso-hunt").then((m) => m.HuntView), {
  loading,
});

export default function ESOApp({ companyCode }: { companyCode?: string } = {}) {
  const sidebarRef = useRef<HTMLElement>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null),
    [users, setUsers] = useState<User[]>([]),
    [reports, setReports] = useState<ESOReport[]>([]),
    [topEmployeeYtd, setTopEmployeeYtd] = useState<{
      id: string;
      name: string;
      employeeId: string;
      count: number;
    } | null>(null),
    [tracking, setTracking] = useState<TrackingData | null>(null),
    [departments, setDepartments] = useState<Department[]>([]),
    [locations, setLocations] = useState<Location[]>([]),
    [plants, setPlants] = useState<Plant[]>([]),
    [corporatePlants, setCorporatePlants] = useState<any[]>([]),
    [view, setView] = useState<View>("dashboard"),
    [selected, setSelected] = useState<ESOReport | null>(null),
    [passwordOpen, setPasswordOpen] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [notifications, setNotifications] = useState<AppNotification[]>([]),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [voeReports, setVoeReports] = useState<VoEReport[]>([]),
    [theme, setTheme] = useState<"light" | "dark">("light");
  const [voeLoading, setVoeLoading] = useState(false),
    [voeError, setVoeError] = useState("");
  const [loadError, setLoadError] = useState("");
  usePhoneBack(view, Boolean(currentUser), (previous) => {
    setView(previous as View);
    requestAnimationFrame(resetPageScroll);
    if (previous === "voe-history" || previous === "voe-all") void loadVoe();
  }, () => {
    if (passwordOpen) { setPasswordOpen(false); return true; }
    if (notificationsOpen) { setNotificationsOpen(false); return true; }
    if (selected) { setSelected(null); return true; }
    if (mobileNav) { setMobileNav(false); return true; }
    return false;
  });
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummary | null>(null);
  const [history, setHistory] = useState<ESOReport[] | null>(null),
    [historyError, setHistoryError] = useState("");
  const historyCache = useRef<ESOReport[] | null>(null),
    historyFlight = useRef<Promise<ESOReport[]> | null>(null),
    historyEpoch = useRef(0);
  const needsHistory = [
    "maintenance",
    "employees",
    "departments",
    "hunt",
  ].includes(view);
  const invalidateHistory = () => {
    historyEpoch.current++;
    historyCache.current = null;
    historyFlight.current = null;
    setHistory(null);
    setHistoryError("");
  };
  const getHistory = (): Promise<ESOReport[]> => {
    if (historyCache.current) return Promise.resolve(historyCache.current);
    if (historyFlight.current) return historyFlight.current;
    const epoch = historyEpoch.current;
    const flight = json("/api/reports/history")
      .then((d) => {
        if (epoch !== historyEpoch.current)
          throw new Error("Data changed. Please retry.");
        historyCache.current = d.reports;
        setHistory(d.reports);
        setHistoryError("");
        return d.reports as ESOReport[];
      })
      .finally(() => {
        if (historyFlight.current === flight) historyFlight.current = null;
      });
    historyFlight.current = flight;
    return flight;
  };
  const loadHistoryView = () => {
    setHistoryError("");
    void getHistory().catch((e) => setHistoryError(e.message));
  };
  useEffect(() => {
    if (currentUser && needsHistory) loadHistoryView();
  }, [view, reports, currentUser?.id]);
  const openReportById = async (id: string) => {
    try {
      const data = await json(
        "/api/reports/history?id=" + encodeURIComponent(id),
      );
      if (data.reports[0]) setSelected(data.reports[0]);
      else setLoadError("ESO not found");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };
  const voeRequest = useRef(0);
  const loadVoe = async () => {
    const request = ++voeRequest.current;
    setVoeLoading(true);
    setVoeError("");
    try {
      const d = await json("/api/voe");
      if (request === voeRequest.current) setVoeReports(d.reports || []);
    } catch (e) {
      if (request === voeRequest.current) setVoeError((e as Error).message);
    } finally {
      if (request === voeRequest.current) setVoeLoading(false);
    }
  };
  const loadNotifications = async () => {
    try {
      const d = await json("/api/notifications");
      setNotifications(d.notifications || []);
    } catch {
      setNotifications([]);
    }
  };
  const load = async () => {
    setLoadError("");
    try {
      const d = await json("/api/data");
      invalidateHistory();
      setDashboardSummary(d.dashboard || null);
      setCurrentUser(d.currentUser);
      setUsers(d.users);
      setReports(d.reports);
      setSelected((previous) =>
        previous
          ? d.reports.find((r: ESOReport) => r.id === previous.id) || previous
          : null,
      );
      setTopEmployeeYtd(d.topEmployeeYtd || null);
      setTracking(d.tracking || null);
      setDepartments(d.departments);
      setLocations(d.locations);
      setPlants(d.plants || []);
      setCorporatePlants(d.corporatePlants || []);
      if (selected) {
        const detail = await json(
          "/api/reports/history?id=" + encodeURIComponent(selected.id),
        );
        setSelected((previous) =>
          previous?.id === selected.id ? detail.reports[0] || null : previous,
        );
      }
      void loadNotifications();
      if (view === "voe-history" || view === "voe-all") void loadVoe();
      return null;
    } catch (e: any) {
      if (e instanceof RequestError && [401, 403].includes(e.status)) {
        invalidateHistory();
        setSelected(null);
        setCurrentUser(null);
        setNotifications([]);
      } else {
        console.error("ESO data load failed:", e);
        setLoadError("Could not load data. Please retry.");
      }
      return e?.message || "Could not load ESO data. Check the server logs.";
    } finally {
      setLoading(false);
    }
  };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const error = await load();
      if (error) throw new Error(error);
    } catch (e: any) {
      alert(e.message || "Could not refresh ESO data.");
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem("eso-theme");
    const next = saved === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("eso-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!mobileNav) return;
    if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
    const desktop = window.matchMedia("(min-width:1301px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileNav(false); };
    desktop.addEventListener("change", closeOnDesktop);
    const y = window.scrollY;
    const body = document.body;
    body.classList.add("nav-open");
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      body.classList.remove("nav-open");
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      window.scrollTo(0, y);
    };
  }, [mobileNav]);
  useEffect(() => {
    const frame = requestAnimationFrame(resetPageScroll);
    return () => cancelAnimationFrame(frame);
  }, [view, loading, currentUser?.id]);
  useEffect(() => {
    if (!loading) window.dispatchEvent(new CustomEvent('eso-auth-ready', {detail:{authenticated:Boolean(currentUser)}}));
  }, [loading, currentUser?.id]);
  if (loading) return <LoadingStatus fullScreen />;
  if (!currentUser && loadError)
    return (
      <div className="login-page">
        <section className="login-card" role="alert">
          <h1>Connection problem</h1>
          <p>{loadError}</p>
          <button
            className="primary-btn"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw size={18} />
            RETRY
          </button>
        </section>
      </div>
    );
  if (!currentUser)
    return (
      <Login
        companyCode={companyCode}
        onLogin={async () => {
          const dataError = await load();
          if (dataError) throw new Error(dataError);
          setView("dashboard");
        }}
      />
    );
  const go = (v: View) => {
    requestAnimationFrame(resetPageScroll);
    setView(v);
    setMobileNav(false);
    if (v === "voe-history" || v === "voe-all") void loadVoe();
  };
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    invalidateHistory();
    setSelected(null);
    setCurrentUser(null);
    setNotifications([]);
  };
  const unread = notifications.filter((n) => !n.isRead).length;
  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">
              <img src="/eso-shield.png" alt="ESO safety shield" />
            </span>
            <BrandWordmark />
          </div>
          <div className="top-user">
            {currentUser.companyName && (
              <>
                <b data-no-translate>{currentUser.companyName}</b>
                <span>•</span>
              </>
            )}
            {currentUser.plantName && (
              <>
                <b data-no-translate>{currentUser.plantName}</b>
                <span>•</span>
              </>
            )}
            <span data-no-translate>{currentUser.name}</span>
            <span>•</span>ID {currentUser.employeeId}
          </div>
          <button
            className="mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={22} />
          </button>
        </header>
        {mobileNav && <button type="button" className="sidebar-dismiss-layer" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
        <aside ref={sidebarRef} className={`sidebar ${mobileNav ? "open" : ""}`}>
          <div className="profile-card">
            <div className="avatar">
              {currentUser.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <strong data-no-translate>{currentUser.name}</strong>
              <span>{currentUser.role}</span>
              <small>
                {currentUser.plantName ? `${currentUser.plantName} • ` : ""}
                {currentUser.department}
              </small>
            </div>
          </div>
          <nav>
            <Nav
              icon={<Home size={17} />}
              label="Dashboard"
              active={view === "dashboard"}
              onClick={() => go("dashboard")}
            />
            <Nav
              icon={<Plus size={17} />}
              label="Report ESO"
              active={view === "report"}
              onClick={() => go("report")}
            />
            <Nav
              icon={<ClipboardList size={17} />}
              label="My ESO History"
              active={view === "my-history"}
              onClick={() => go("my-history")}
            />
            {canMaintain(currentUser.role) && (
              <Nav
                icon={<Wrench size={17} />}
                label={
                  canAdmin(currentUser.role)
                    ? "Corrective Action Tasks"
                    : "My Tasks"
                }
                active={view === "maintenance"}
                onClick={() => go("maintenance")}
              />
            )}
            {canViewAll(currentUser.role) && (
              <>
                <div className="nav-section">ESO</div>
                <Nav
                  icon={<FileText size={17} />}
                  label="All ESO Reports"
                  active={view === "all-reports"}
                  onClick={() => go("all-reports")}
                />
                <Nav
                  icon={<Download size={17} />}
                  label="Data & Reports"
                  active={view === "exports"}
                  onClick={() => go("exports")}
                />
              </>
            )}
            <div className="nav-section hunt-section">ESO HUNT</div>
            <Nav
              icon={<Trophy size={17} />}
              label="ESO Hunt"
              active={view === "hunt"}
              onClick={() => go("hunt")}
            />
            <div className="nav-section voe-section">VOICE OF EMPLOYEE</div>
            <Nav
              icon={<MessageSquare size={17} />}
              label="Submit Voice"
              active={view === "voe-submit"}
              onClick={() => go("voe-submit")}
            />
            <Nav
              icon={<ClipboardList size={17} />}
              label="My Voice History"
              active={view === "voe-history"}
              onClick={() => go("voe-history")}
            />
            {canViewAll(currentUser.role) && (
              <Nav
                icon={<MessageSquare size={17} />}
                label="Voice of Employee"
                active={view === "voe-all"}
                onClick={() => go("voe-all")}
              />
            )}
            {canAdmin(currentUser.role) && (
              <>
                <div className="nav-section">ADMINISTRATION</div>
                {currentUser.role === "Super Admin" && (
                  <Nav
                    icon={<Database size={17} />}
                    label="Plants"
                    active={view === "plants"}
                    onClick={() => go("plants")}
                  />
                )}
                <Nav
                  icon={<Users size={17} />}
                  label="Employee Tracker"
                  active={view === "employees"}
                  onClick={() => go("employees")}
                />
                <Nav
                  icon={<Database size={17} />}
                  label="Departments"
                  active={view === "departments"}
                  onClick={() => go("departments")}
                />
                <Nav
                  icon={<MapPin size={17} />}
                  label="Locations"
                  active={view === "locations"}
                  onClick={() => go("locations")}
                />
              </>
            )}
          </nav>
          <div className="sidebar-bottom">
            <LanguageControl />
            <ThemeControl
              theme={theme}
              onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <PushControl />
            <button
              onClick={() => {
                setNotificationsOpen(true);
                loadNotifications();
              }}
            >
              <Bell size={17} /> Notifications{" "}
              {unread > 0 && (
                <span className="notification-count">{unread}</span>
              )}
            </button>
            {
              <button onClick={() => setPasswordOpen(true)}>
                <KeyRound size={17} /> Change password
              </button>
            }
            <button onClick={logout}>
              <LogOut size={17} /> Log out
            </button>
          </div>
        </aside>
        <main className="content">
          {loadError && (
            <div className="form-error" role="alert">
              {loadError}
            </div>
          )}
          {needsHistory &&
            history === null &&
            (historyError ? (
              <div className="form-error" role="alert">
                {historyError}
                <button className="outline-btn" onClick={loadHistoryView}>
                  <RefreshCw size={16} />
                  Retry
                </button>
              </div>
            ) : (
              <LoadingStatus label="Loading report history…" />
            ))}
          {view === "dashboard" && (
            <Dashboard
              user={currentUser}
              users={users}
              reports={reports}
              summary={dashboardSummary}
              getHistory={getHistory}
              topEmployeeYtd={topEmployeeYtd}
              tracking={tracking}
              corporatePlants={corporatePlants}
              onReport={() => go("report")}
              onRefresh={refresh}
              refreshing={refreshing}
              onOpen={setSelected}
            />
          )}
          {view === "hunt" && history !== null && (
            <HuntView
              currentUser={currentUser}
              users={users}
              plants={plants}
              locations={locations}
              reports={history!}
              onOpen={setSelected}
            />
          )}
          {view === "report" && (
            <div className="page report-entry-page">
              <Title
                title="Report ESO"
                subtitle={`${currentUser.name} • Environmental & Safety Opportunity`}
              />
              <ReportEntry
                user={currentUser}
                locations={locations.filter((l) => l.active !== false)}
                onDone={async () => {
                  await load();
                  go("my-history");
                }}
              />
            </div>
          )}
          {view === "my-history" && (
            <div className="page report-list-page">
              <Title title="My ESO History" />
              <ReportsTable
                title="My ESO History"
                serverPaging
                mineOnly
                locations={locations}
                reports={reports}
                users={users}
                onOpen={setSelected}
              />
            </div>
          )}
          {view === "all-reports" && (
            <div className="page report-list-page">
              <Title title="All ESO Submissions" />
              <ReportsTable
                mobileTable
                title="All ESO Submissions"
                serverPaging
                locations={locations}
                reports={reports}
                users={users}
                onOpen={setSelected}
                adminFilters
              />
            </div>
          )}
          {view === "maintenance" && history !== null && (
            <TaskWorkspace
              currentUser={currentUser}
              reports={history!}
              users={users}
              onOpen={setSelected}
              reload={load}
            />
          )}
          {view === "employees" && history !== null && (
            <Employees
              currentUser={currentUser}
              users={users}
              reports={history!}
              departments={departments}
              plants={plants}
              reload={load}
            />
          )}
          {view === "departments" && history !== null && (
            <Departments
              currentUser={currentUser}
              departments={departments}
              users={users}
              reports={history!}
              plants={plants}
              reload={load}
              onOpen={setSelected}
            />
          )}
          {view === "locations" && (
            <Locations
              currentUser={currentUser}
              locations={locations}
              departments={departments}
              plants={plants}
              reload={load}
            />
          )}
          {view === "plants" && (
            <Plants
              currentUser={currentUser}
              plants={plants}
              corporatePlants={corporatePlants}
              reload={load}
            />
          )}
          {view === "exports" && (
            <Exports
              departments={departments}
              closureRates={tracking?.closureRates}
            />
          )}
          {view === "voe-submit" && (
            <VoESubmit
              onDone={async () => {
                setView("voe-history");
                setMobileNav(false);
                await loadVoe();
              }}
            />
          )}
          {view === "voe-history" && (
            <VoEList
              title="My Voice History"
              reports={voeReports.filter(
                (v) => v.reporterId === currentUser.id,
              )}
              canManage={false}
              reload={loadVoe}
              loading={voeLoading}
              error={voeError}
            />
          )}
          {view === "voe-all" && canViewAll(currentUser.role) && (
            <VoEList
              title="Voice of Employee"
              reports={voeReports}
              canManage
              reload={loadVoe}
              loading={voeLoading}
              error={voeError}
            />
          )}
          <SiteFooter />
        </main>
        {!mobileNav && (
          <MobileQuickNav user={currentUser} view={view} go={go} />
        )}
        {selected && (
          <ReportModal
            report={selected}
            users={users}
            locations={locations}
            currentUser={currentUser}
            onChanged={load}
            onClose={() => setSelected(null)}
          />
        )}
        {passwordOpen && (
          <PasswordModal onClose={() => setPasswordOpen(false)} />
        )}
        {notificationsOpen && (
          <NotificationsPanel
            notifications={notifications}
            reports={reports}
            onClose={() => setNotificationsOpen(false)}
            onOpenReport={(id) => {
              void openReportById(id);
              setNotificationsOpen(false);
            }}
            reload={loadNotifications}
          />
        )}
      </div>
    </>
  );
}

export function Nav({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      <ChevronRight size={15} />
    </button>
  );
}

export function ThemeControl({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <button
      className="theme-control"
      onClick={onToggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span>{theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}</span>
      <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
      <i className={`theme-switch ${theme}`}>
        <b />
      </i>
    </button>
  );
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4),
    base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/"),
    raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushControl() {
  const [supported, setSupported] = useState(false),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
    navigator.serviceWorker?.ready
      .then(async (r) => setEnabled(!!(await r.pushManager.getSubscription())))
      .catch(() => {});
  }, []);
  const toggle = async () => {
    if (!supported || busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready,
        current = await reg.pushManager.getSubscription();
      if (current) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: current.endpoint }),
        });
        await current.unsubscribe();
        setEnabled(false);
      } else {
        const k = await json("/api/push/public-key");
        if (!k.publicKey)
          throw new Error("Push is not configured on the server.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw new Error("Notifications were not allowed on this device.");
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(k.publicKey),
        });
        await json("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        setEnabled(true);
      }
    } catch (e: any) {
      alert(e.message || "Could not enable push notifications.");
    } finally {
      setBusy(false);
    }
  };
  if (!supported) return null;
  return (
    <button onClick={toggle} disabled={busy}>
      <Bell size={17} />
      {busy
        ? "Please wait…"
        : enabled
          ? "Push notifications ON"
          : "Enable push notifications"}
    </button>
  );
}

export function PasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await json("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <form className="small-modal" onSubmit={submit}>
        <h3>Change Password</h3>
        {done ? (
          <>
            <div className="success-box">Password changed successfully.</div>
            <button type="button" className="primary-btn" onClick={onClose}>
              <ActionCheckCheck
                size={16}
                aria-hidden="true"
                className="action-icon"
              />
              Done
            </button>
          </>
        ) : (
          <>
            <PasswordInput
              label="Current Password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <PasswordInput
              label="New Password"
              required
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordInput
              label="Confirm New Password"
              required
              autoComplete="new-password"
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="outline-btn" onClick={onClose}>
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Cancel
              </button>
              <button className="primary-btn" disabled={busy}>
                <ActionKeyRound
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                {busy ? "SAVING…" : "CHANGE PASSWORD"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export function NotificationsPanel({
  notifications,
  reports,
  onClose,
  onOpenReport,
  reload,
}: {
  notifications: AppNotification[];
  reports: ESOReport[];
  onClose: () => void;
  onOpenReport: (id: string) => void;
  reload: () => Promise<void>;
}) {
  const mark = async (id?: string) => {
    await json("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    await reload();
  };
  return (
    <div className="modal-backdrop">
      <div className="notifications-modal">
        <div className="notifications-head">
          <div>
            <h3>Notifications</h3>
            <span>{notifications.filter((n) => !n.isRead).length} unread</span>
          </div>
          <button className="outline-small" onClick={() => mark()}>
            <ActionCheckCheck
              size={16}
              aria-hidden="true"
              className="action-icon"
            />
            MARK ALL READ
          </button>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="empty">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`notification-item ${n.isRead ? "read" : "unread"}`}
                onClick={async () => {
                  if (!n.isRead) await mark(n.id);
                  if (n.esoReportId) onOpenReport(n.esoReportId);
                }}
              >
                <Bell size={17} />
                <div>
                  <b>{n.title}</b>
                  {n.message && <p>{n.message}</p>}
                  <small>{<LocalizedDate value={n.createdAt} format="dateTime"/>}</small>
                </div>
                {!n.isRead && <i />}
              </button>
            ))
          )}
        </div>
        <div className="notification-help">
          <b>How notifications work</b>
          <p>
            New ESO reports notify Management/Admin roles. Assigned tasks notify
            the selected Maintenance/Supervisor. Task progress and completion
            notify the responsible oversight roles. Opening a notification marks
            it as read.
          </p>
        </div>
      </div>
    </div>
  );
}

export type View =
  | "dashboard"
  | "report"
  | "my-history"
  | "all-reports"
  | "maintenance"
  | "employees"
  | "departments"
  | "locations"
  | "plants"
  | "exports"
  | "voe-submit"
  | "voe-history"
  | "voe-all"
  | "hunt";




