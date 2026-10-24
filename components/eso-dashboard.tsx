"use client";
import { Building2 as ActionBuilding2 } from "lucide-react";
import { useState, useRef, useEffect, Children, cloneElement, isValidElement } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  Wrench,
  X,
  Trophy,
} from "lucide-react";
import type { ClosureRates, ESOReport, User } from "@/types";
import { fiscalYearInfo, inCurrentFY } from "@/lib/fiscal-year";
import LoadingStatus from "./loading-status";
import { Title } from "./eso-shared";
import { ReportsTable } from "./eso-reports";

function MetricCarousel({children}:{children:React.ReactNode}){
  const track=useRef<HTMLDivElement>(null);
  const pausedUntil=useRef(0);
  const pause=()=>{pausedUntil.current=Date.now()+3000;};
  useEffect(()=>{
    const el=track.current;if(!el)return;
    const mobile=window.matchMedia('(max-width:800px)');
    const reduced=window.matchMedia('(prefers-reduced-motion:reduce)');
    let frame=0,last=0,position=0,cycleWidth=0;
    const measure=()=>{
      if(!mobile.matches){el.scrollLeft=0;cycleWidth=0;return;}
      const first=el.querySelector<HTMLElement>('[data-cycle="0"]');
      const middle=el.querySelector<HTMLElement>('[data-cycle="1"]');
      if(first&&middle){cycleWidth=middle.offsetLeft-first.offsetLeft;position=cycleWidth;el.scrollLeft=position;}
    };
    const resize=new ResizeObserver(measure);resize.observe(el);measure();
    const normalize=()=>{
      if(!cycleWidth)return;
      const current=el.scrollLeft;
      if(current<cycleWidth*.5){el.scrollLeft=current+cycleWidth;position=el.scrollLeft;}
      else if(current>=cycleWidth*1.5){el.scrollLeft=current-cycleWidth;position=el.scrollLeft;}
    };
    el.addEventListener('scroll',normalize,{passive:true});
    const animate=(time:number)=>{
      const elapsed=last?Math.min(time-last,50):0;last=time;
      if(mobile.matches&&!reduced.matches&&!document.hidden&&Date.now()>=pausedUntil.current&&!el.querySelector(":focus-visible")&&!document.querySelector('.modal-backdrop')){
        // Increasing scrollLeft moves the visible cards from right to left.
        position+=elapsed*.022;
        if(cycleWidth&&position>=cycleWidth*1.5)position-=cycleWidth;
        el.scrollLeft=position;
      }else position=el.scrollLeft;
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);resize.disconnect();el.removeEventListener('scroll',normalize);};
  },[]);
  return <div ref={track} className="dashboard-metric-carousel" onPointerDown={pause} onWheel={pause} onTouchMove={pause} onKeyDown={pause}>{[0,1,2].flatMap(cycle=>Children.toArray(children).map((child,index)=>isValidElement<Record<string,unknown>>(child)?cloneElement(child,{
    key:`metric-${cycle}-${index}`,
    'data-cycle':cycle,
    'aria-hidden':cycle!==1?true:undefined,
    tabIndex:cycle!==1?-1:(child.props.tabIndex??0),
    style:{...(child.props.style as React.CSSProperties), '--metric-order':cycle*6+([0,1,3,2,4,5][index]??index)} as React.CSSProperties,
  }):child))}</div>;
}

export function Dashboard({
  user,
  users,
  reports,
  topEmployeeYtd,
  summary,
  getHistory,
  tracking,
  corporatePlants,
  onReport,
  onRefresh,
  refreshing,
  onOpen,
}: {
  user: User;
  users: User[];
  reports: ESOReport[];
  summary?: DashboardSummary | null;
  getHistory: HistoryLoader;
  topEmployeeYtd: {
    id: string;
    name: string;
    employeeId: string;
    count: number;
  } | null;
  tracking: TrackingData | null;
  corporatePlants: any[];
  onReport: () => void;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  onOpen: (r: ESOReport) => void;
}) {
  const [kpiView, setKpiView] = useState<{
    title: string;
    reports: ESOReport[];
  } | null>(null);
  const { runHistory, feedback, refreshHistory, cancelHistory } =
    useHistoryAction(getHistory);
  useEffect(() => {
    if (kpiView) refreshHistory();
  }, [reports]);
  const openKpi = (
    build: (reports: ESOReport[]) => { title: string; reports: ESOReport[] },
  ) => runHistory((rows) => setKpiView(build(rows)));
  const fy = fiscalYearInfo(),
    year = fy.label,
    yr = reports.filter((r) => inCurrentFY(r.createdAt));
  if (user.role === "Employee") {
    const mine = yr.filter((r) => r.reporterId === user.id),
      mineCount = summary?.ytd ?? mine.length,
      pct =
        user.annualTarget > 0
          ? Math.min(100, Math.round((mineCount / user.annualTarget) * 100))
          : 0;
    return (
      <div className="page">
        {feedback}
        <Title
          title="My ESO Dashboard"
          subtitle={`${user.name} • ${user.department}`}
        />
        <div className="employee-dashboard-row">
          <div
            className="employee-hero clickable-kpi"
            role="button"
            tabIndex={0}
            onClick={() =>
              openKpi((reports) => {
                const yr = reports.filter((r) => inCurrentFY(r.createdAt));
                const mine = yr.filter((r) => r.reporterId === user.id);
                return { title: `My ESO YTD — ${year}`, reports: mine };
              })
            }
          >
            <div>
              <span>ANNUAL ESO TARGET</span>
              <h2>
                {mineCount} <small>/ {user.annualTarget}</small>
              </h2>
              <div className="progress">
                <i style={{ width: `${pct}%` }} />
              </div>
              <p>
                {Math.max(0, user.annualTarget - mineCount)} reports remaining
              </p>
            </div>
            <button
              className="report-big"
              onClick={(e) => {
                e.stopPropagation();
                onReport();
              }}
            >
              <Plus size={24} /> REPORT ESO
            </button>
          </div>
          <TopEmployeeCard top={topEmployeeYtd} />
        </div>
        <ReportsTable
          mobileTable
          title="Recent submissions"
          reports={mine.slice(0, 5)}
          users={users}
          onOpen={onOpen}
        />
        {kpiView && (
          <KpiReportsModal
            title={kpiView.title}
            reports={kpiView.reports.map(
              (item) => reports.find((r) => r.id === item.id) || item,
            )}
            users={users}
            onOpen={onOpen}
            onClose={() => {
              cancelHistory();
              setKpiView(null);
            }}
          />
        )}
      </div>
    );
  }
  const open = reports.filter((r) => r.status === "Open").length,
    inProgress = reports.filter((r) => r.status === "In Progress").length,
    completed = reports.filter((r) => r.status === "Completed").length,
    critical = reports.filter(
      (r) => r.urgency === "Critical" && r.status !== "Completed",
    ).length,
    overdue = reports.filter((r) => r.overdue).length,
    topResolver = tracking?.resolverLeaderboard[0] || null;
  return (
    <div className="page">
      {feedback}
      <div className="dashboard-heading">
        <Title
          title="ESO Dashboard"
          subtitle={`${year} performance overview`}
        />
        <div className="dashboard-heading-actions">
          <button
            className="outline-btn compact"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />{" "}
            {refreshing ? "REFRESHING…" : "REFRESH"}
          </button>
          <button className="primary-btn compact" onClick={onReport}>
            <Plus size={17} /> REPORT ESO
          </button>
        </div>
      </div>
      <div className="dashboard-summary-grid">
        <MetricCarousel>
        <StatCard
          label="ESO YTD"
          value={summary?.ytd ?? yr.length}
          color="blue"
          icon={<FileText size={22} />}
          onClick={() =>
            openKpi((reports) => {
              const yr = reports.filter((r) => inCurrentFY(r.createdAt));
              const mine = yr.filter((r) => r.reporterId === user.id);
              return { title: `All ESO YTD — ${year}`, reports: yr };
            })
          }
        />
        <StatCard
          label="OPEN"
          value={summary?.open ?? open}
          color="orange"
          icon={<AlertCircle size={22} />}
          onClick={() =>
            openKpi((reports) => {
              const yr = reports.filter((r) => inCurrentFY(r.createdAt));
              const mine = yr.filter((r) => r.reporterId === user.id);
              return {
                title: "Open ESO",
                reports: reports.filter((r) => r.status === "Open"),
              };
            })
          }
        />
        <StatCard
          label="IN PROGRESS"
          value={summary?.inProgress ?? inProgress}
          color="purple"
          icon={<LoaderCircle size={22} />}
          onClick={() =>
            openKpi((reports) => {
              const yr = reports.filter((r) => inCurrentFY(r.createdAt));
              const mine = yr.filter((r) => r.reporterId === user.id);
              return {
                title: "ESO In Progress",
                reports: reports.filter((r) => r.status === "In Progress"),
              };
            })
          }
        />
        <StatCard
          label="COMPLETED"
          value={summary?.completed ?? completed}
          color="green"
          icon={<CheckCircle2 size={22} />}
          onClick={() =>
            openKpi((reports) => {
              const yr = reports.filter((r) => inCurrentFY(r.createdAt));
              const mine = yr.filter((r) => r.reporterId === user.id);
              return {
                title: "Completed ESO",
                reports: reports.filter((r) => r.status === "Completed"),
              };
            })
          }
        />

        <div
          className="critical-highlight clickable-kpi"
          role="button"
          tabIndex={0}
          onClick={() =>
            openKpi((reports) => {
              const yr = reports.filter((r) => inCurrentFY(r.createdAt));
              const mine = yr.filter((r) => r.reporterId === user.id);
              return {
                title: "Critical Open ESO",
                reports: reports.filter(
                  (r) => r.urgency === "Critical" && r.status !== "Completed",
                ),
              };
            })
          }
        >
          <div>
            <span>CRITICAL OPEN</span>
            <strong>{summary?.critical ?? critical}</strong>
          </div>
          <div className="critical-icon">
            <ShieldAlert size={26} />
          </div>
        </div>
        <div
          className="overdue-highlight clickable-kpi"
          role="button"
          tabIndex={0}
          onClick={() =>
            openKpi((reports) => {
              const yr = reports.filter((r) => inCurrentFY(r.createdAt));
              const mine = yr.filter((r) => r.reporterId === user.id);
              return {
                title: "Overdue Corrective Actions",
                reports: reports.filter((r) => r.overdue),
              };
            })
          }
        >
          <div>
            <span>OVERDUE</span>
            <strong>{summary?.overdue ?? overdue}</strong>
          </div>
          <div className="overdue-icon">
            <CalendarClock size={26} />
          </div>
        </div>

        </MetricCarousel>
        <TopResolverCard
          top={topResolver}
          onClick={
            topResolver
              ? () =>
                  openKpi((reports) => {
                    const yr = reports.filter((r) => inCurrentFY(r.createdAt));
                    const mine = yr.filter((r) => r.reporterId === user.id);
                    return {
                      title: `${topResolver.name} — Resolved ESO YTD`,
                      reports: reports.filter(
                        (r) =>
                          r.status === "Completed" &&
                          r.resolvedBy === topResolver.id &&
                          inCurrentFY(r.completedAt || r.createdAt),
                      ),
                    };
                  })
              : undefined
          }
        />
        <TopEmployeeCard
          top={topEmployeeYtd}
          onClick={
            topEmployeeYtd
              ? () =>
                  openKpi((reports) => {
                    const yr = reports.filter((r) => inCurrentFY(r.createdAt));
                    const mine = yr.filter((r) => r.reporterId === user.id);
                    return {
                      title: `${topEmployeeYtd.name} — ESO YTD`,
                      reports: yr.filter(
                        (r) => r.reporterId === topEmployeeYtd.id,
                      ),
                    };
                  })
              : undefined
          }
        />
      </div>
      {user.role === "Super Admin" && corporatePlants.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Corporate Plant Overview</h3>
            <span>Company → Plant → Department → Employee</span>
          </div>
          <div className="department-cards">
            {corporatePlants.map((p: any) => (
              <div className="dept-card" key={p.id}>
                <div>
                  <b data-no-translate>{p.name}</b>
                  <span>
                    {p.code} • {p.employees} employees
                  </span>
                </div>
                <strong>
                  {p.reportedYtd}
                  <small> reported YTD</small>
                </strong>
                <div className="mini-progress">
                  <i
                    style={{
                      width: `${Math.min(100, p.reportedYtd ? Math.round((p.resolvedYtd / p.reportedYtd) * 100) : 0)}%`,
                    }}
                  />
                </div>
                <small>
                  {p.resolvedYtd} resolved • {p.open} open •{" "}
                  <b className={p.overdue ? "overdue-text" : ""}>
                    {p.overdue || 0} overdue
                  </b>
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
      <DepartmentPerformance
        users={users}
        reports={reports}
        onOpen={onOpen}
        compact
        reporterCounts={tracking?.reporterLeaderboard}
        getHistory={getHistory}
      />
      <PlantYearSummary
        user={user}
        users={users}
        reports={reports}
        tracking={tracking}
        summary={summary}
      />
      {tracking && (
        <TrackingInsights
          tracking={tracking}
          getHistory={getHistory}
          reports={reports}
          users={users}
          onOpen={onOpen}
        />
      )}
      <ReportsTable
        mobileTable
        title="Latest ESO Submissions"
        reports={reports.slice(0, 10)}
        users={users}
        onOpen={onOpen}
      />
      {kpiView && (
        <KpiReportsModal
          title={kpiView.title}
          reports={kpiView.reports.map(
            (item) => reports.find((r) => r.id === item.id) || item,
          )}
          users={users}
          onOpen={onOpen}
          onClose={() => {
            cancelHistory();
            setKpiView(null);
          }}
        />
      )}
    </div>
  );
}

export function TopEmployeeCard({
  top,
  onClick,
}: {
  top: { id: string; name: string; employeeId: string; count: number } | null;
  onClick?: () => void;
}) {
  return (
    <div
      className={`top-employee-card ${onClick ? "clickable-kpi" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
      }}
    >
      <div className="top-employee-icon">
        <Trophy size={26} />
      </div>
      <div className="top-employee-copy">
        <span>EMPLOYEE WITH MOST ESO YTD</span>
        <strong>{top?.name || "No submissions yet"}</strong>
        {top && <em>ID {top.employeeId}</em>}
      </div>
      <div className="top-employee-score">
        <b>{top?.count || 0}</b>
        <small>ESO YTD</small>
      </div>
    </div>
  );
}

export function TopResolverCard({
  top,
  onClick,
}: {
  top: ResolverStat | null;
  onClick?: () => void;
}) {
  return (
    <div
      className={`top-employee-card top-resolver-card ${onClick ? "clickable-kpi" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
      }}
    >
      <div className="top-employee-icon top-resolver-icon">
        <Wrench size={26} />
      </div>
      <div className="top-employee-copy">
        <span>TOP ESO RESOLVER YTD</span>
        <strong>{top?.name || "No resolutions yet"}</strong>
        {top && (
          <em>
            {top.role}
            {top.employeeId ? ` • ID ${top.employeeId}` : ""}
          </em>
        )}
      </div>
      <div className="top-employee-score">
        <b>{top?.resolvedYtd || 0}</b>
        <small>RESOLVED YTD</small>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  color,
  icon,
  onClick,
  ...attributes
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  onClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`stat-card ${color} ${onClick ? "clickable-kpi" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
      }}
      {...attributes}
    >
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}

export function ClosureRateMini({ rates }: { rates: ClosureRates }) {
  const items = [
    ["week", "This week", rates.week],
    ["month", "This month", rates.month],
    ["year", "Fiscal year", rates.year],
  ] as const;
  return (
    <div className="closure-rate-mini">
      <div className="closure-rate-mini-head">
        <div>
          <h3>ESO closure rate</h3>
          <span>Closed from reports created in each period</span>
        </div>
        <CheckCircle2 size={17} />
      </div>
      <div className="closure-rate-mini-grid">
        {items.map(([key, label, period]) => (
          <div className={`closure-rate-mini-card ${key}`} key={key}>
            <div>
              <span>{label}</span>
              <strong>{period.rate}%</strong>
            </div>
            <div className="closure-rate-mini-bar">
              <i style={{ width: `${period.rate}%` }} />
            </div>
            <small>
              {period.closed} closed · {period.reported} reported ·{" "}
              {period.open} open
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiReportsModal({
  title,
  reports,
  users,
  onOpen,
  onClose,
}: {
  title: string;
  reports: ESOReport[];
  users: User[];
  onOpen: (r: ESOReport) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal kpi-modal">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <span>{reports.length} records</span>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">
          <ReportsTable
            title={title}
            reports={reports}
            users={users}
            onOpen={onOpen}
          />
        </div>
      </div>
    </div>
  );
}

export function TrackingInsights({
  getHistory,
  tracking,
  reports,
  users,
  onOpen,
}: {
  getHistory: HistoryLoader;
  tracking: TrackingData;
  reports: ESOReport[];
  users: User[];
  onOpen: (r: ESOReport) => void;
}) {
  const { runHistory, feedback, refreshHistory, cancelHistory } =
    useHistoryAction(getHistory);
  const maxReported = Math.max(1, ...tracking.monthly.map((x) => x.reported)),
    maxResolved = Math.max(1, ...tracking.monthly.map((x) => x.resolved));
  const current = tracking.monthly[tracking.currentMonth - 1],
    [resolverView, setResolverView] = useState<{
      title: string;
      reports: ESOReport[];
    } | null>(null),
    [reporterView, setReporterView] = useState<{
      title: string;
      reports: ESOReport[];
    } | null>(null);
  useEffect(() => {
    if (reporterView || resolverView) refreshHistory();
  }, [reports]);
  const reporterReports = (reporter: ReporterStat, reports: ESOReport[]) =>
    reports.filter(
      (r) => r.reporterId === reporter.id && inCurrentFY(r.createdAt),
    );
  const resolverReports = (resolver: ResolverStat, reports: ESOReport[]) =>
    reports.filter(
      (r) =>
        r.status === "Completed" &&
        r.resolvedBy === resolver.id &&
        inCurrentFY(r.completedAt || r.createdAt),
    );
  return (
    <div className="tracking-section">
      {feedback}
      <div className="tracking-summary-grid">
        <MonthlyPanel
          title="ESO Reported per Month"
          subtitle={`Calendar month • 1st to 1st • ${tracking.year}`}
          data={tracking.monthly}
          field="reported"
          max={maxReported}
          currentValue={current?.reported || 0}
          currentMonth={tracking.currentMonth}
        />
        <MonthlyPanel
          title="ESO Resolved per Month"
          subtitle={`Calendar month • 1st to 1st • ${tracking.year}`}
          data={tracking.monthly}
          field="resolved"
          max={maxResolved}
          currentValue={current?.resolved || 0}
          currentMonth={tracking.currentMonth}
        />
      </div>
      <div className="leaderboard-grid">
        <div className="panel reporter-panel">
          <div className="panel-head">
            <h3>
              Top ESO Reporters <span>• {tracking.year} YTD</span>
            </h3>
            <span>Who reported the most ESO opportunities</span>
          </div>
          {tracking.reporterLeaderboard.length === 0 ? (
            <div className="empty">No ESO reports recorded yet.</div>
          ) : (
            <div className="resolver-list">
              {tracking.reporterLeaderboard.slice(0, 5).map((r, i) => (
                <div
                  className="resolver-row clickable-kpi"
                  role="button"
                  tabIndex={0}
                  key={r.id}
                  title={`Show ESO reported by ${r.name}`}
                  onClick={() =>
                    runHistory((rows) =>
                      setReporterView({
                        title: `${r.name} — Reported ESO YTD`,
                        reports: reporterReports(r, rows),
                      }),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      runHistory((rows) =>
                        setReporterView({
                          title: `${r.name} — Reported ESO YTD`,
                          reports: reporterReports(r, rows),
                        }),
                      );
                  }}
                >
                  <div className={`resolver-rank rank-${i + 1}`}>{i + 1}</div>
                  <div className="resolver-person">
                    <b data-no-translate>{r.name}</b>
                    <span>
                      {r.department} • {r.role}
                      {r.employeeId ? ` • ID ${r.employeeId}` : ""}
                    </span>
                  </div>
                  <div className="resolver-metric">
                    <strong>{r.reportedYtd}</strong>
                    <span>Reported YTD</span>
                  </div>
                  <div className="resolver-metric">
                    <strong>{r.reportedThisMonth}</strong>
                    <span>This month</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel resolver-panel">
          <div className="panel-head">
            <h3>
              Top ESO Resolvers <span>• {tracking.year} YTD</span>
            </h3>
            <span>Who completed assigned corrective-action tasks</span>
          </div>
          {tracking.resolverLeaderboard.length === 0 ? (
            <div className="empty">No resolved ESO tasks recorded yet.</div>
          ) : (
            <div className="resolver-list">
              {tracking.resolverLeaderboard.slice(0, 5).map((r, i) => (
                <div
                  className="resolver-row clickable-kpi"
                  role="button"
                  tabIndex={0}
                  key={r.id}
                  title={`Show ESO resolved by ${r.name}`}
                  onClick={() =>
                    runHistory((rows) =>
                      setResolverView({
                        title: `${r.name} — Resolved ESO YTD`,
                        reports: resolverReports(r, rows),
                      }),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      runHistory((rows) =>
                        setResolverView({
                          title: `${r.name} — Resolved ESO YTD`,
                          reports: resolverReports(r, rows),
                        }),
                      );
                  }}
                >
                  <div className={`resolver-rank rank-${i + 1}`}>{i + 1}</div>
                  <div className="resolver-person">
                    <b data-no-translate>{r.name}</b>
                    <span>
                      {r.department} • {r.role}
                      {r.employeeId ? ` • ID ${r.employeeId}` : ""}
                    </span>
                  </div>
                  <div className="resolver-metric">
                    <strong>{r.resolvedYtd}</strong>
                    <span>Resolved YTD</span>
                  </div>
                  <div className="resolver-metric">
                    <strong>{r.resolvedThisMonth}</strong>
                    <span>This month</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {reporterView && (
        <KpiReportsModal
          title={reporterView.title}
          reports={reporterView.reports}
          users={users}
          onOpen={onOpen}
          onClose={() => {
            cancelHistory();
            setReporterView(null);
          }}
        />
      )}{" "}
      {resolverView && (
        <KpiReportsModal
          title={resolverView.title}
          reports={resolverView.reports}
          users={users}
          onOpen={onOpen}
          onClose={() => {
            cancelHistory();
            setResolverView(null);
          }}
        />
      )}
    </div>
  );
}

export function MonthlyPanel({
  title,
  subtitle,
  data,
  field,
  max,
  currentValue,
  currentMonth,
}: {
  title: string;
  subtitle: string;
  data: MonthlyTrackingPoint[];
  field: "reported" | "resolved";
  max: number;
  currentValue: number;
  currentMonth: number;
}) {
  return (
    <div className={`panel monthly-panel ${field}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <span>{subtitle}</span>
        </div>
        <div className="month-current">
          <strong>{currentValue}</strong>
          <small>THIS MONTH</small>
        </div>
      </div>
      <div className="month-grid">
        {data.map((m) => (
          <div
            className={`month-cell ${m.month === currentMonth ? "current" : ""}`}
            key={m.month}
          >
            <span>{m.label}</span>
            <strong>{m[field]}</strong>
            <div className="month-bar">
              <i
                style={{
                  height: `${Math.max(m[field] ? 14 : 2, Math.round((m[field] / max) * 100))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DepartmentPerformance({
  reporterCounts,
  getHistory,
  users,
  reports,
  onOpen,
  compact = false,
}: {
  users: User[];
  reports: ESOReport[];
  onOpen: (r: ESOReport) => void;
  compact?: boolean;
  reporterCounts?: ReporterStat[];
  getHistory?: HistoryLoader;
}) {
  const { runHistory, feedback, refreshHistory, cancelHistory } =
    useHistoryAction(getHistory || (async () => reports));
  const showDepartment = (group: any) =>
    runHistory((rows) => {
      const ids = new Set(
        users
          .filter(
            (u) =>
              u.active &&
              (u.plantId || "") === group.pid &&
              u.department === group.name,
          )
          .map((u) => u.id),
      );
      const list = rows.filter(
        (r) => ids.has(r.reporterId) && inCurrentFY(r.createdAt),
      );
      setSelectedDept({ ...group, reports: list, count: list.length });
    });
  const [selectedDept, setSelectedDept] = useState<any | null>(null),
    [expanded, setExpanded] = useState(!compact),
    multiPlant = new Set(users.map((u) => u.plantId).filter(Boolean)).size > 1,
    keys = Array.from(
      new Set(
        users
          .filter((u) => u.active)
          .map((u) => `${u.plantId || ""}::${u.department}`),
      ),
    ),
    groups = keys.map((key) => {
      const [pid, name] = key.split("::"),
        m = users.filter(
          (u) => u.active && (u.plantId || "") === pid && u.department === name,
        ),
        ids = new Set(m.map((x) => x.id)),
        deptReports = reports.filter(
          (r) => ids.has(r.reporterId) && inCurrentFY(r.createdAt),
        ),
        count = reporterCounts
          ? reporterCounts.reduce(
              (total, r) => total + (ids.has(r.id) ? r.reportedYtd : 0),
              0,
            )
          : deptReports.length,
        target = m.reduce((a, b) => a + b.annualTarget, 0),
        plant = m[0]?.plantName || "";
      return {
        key,
        pid,
        name,
        label: multiPlant && plant ? `${plant} • ${name}` : name,
        plant,
        members: m.length,
        count,
        target,
        pct: target ? Math.round((count / target) * 100) : 0,
        reports: deptReports,
      };
    });
  useEffect(() => {
    if (selectedDept && getHistory) refreshHistory();
  }, [reports]);
  return (
    <>
      <div
        className={`panel department-performance-panel ${compact ? "compact-mode" : ""}`}
      >
        <div className="panel-head department-performance-head">
          <div>
            <h3>Department Performance</h3>
            <span>
              {compact
                ? expanded
                  ? "Click a department to open its ESO list"
                  : "Click to expand department details"
                : "Company → Plant → Department → Employee"}
            </span>
          </div>
          {compact && (
            <button
              type="button"
              className="department-performance-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "COLLAPSE" : "EXPAND"}
              <ChevronRight size={16} className={expanded ? "is-open" : ""} />
            </button>
          )}
        </div>
        {compact && !expanded && (
          <div className="department-compact-list">
            {groups.map((g) => (
              <button
                type="button"
                className="department-compact-item"
                key={g.key}
                onClick={() => showDepartment(g)}
              >
                <span>
                  <ActionBuilding2
                    size={16}
                    aria-hidden="true"
                    className="action-icon"
                  />
                  {g.label}
                </span>
                <b>
                  {g.count} <small>/ {g.target}</small>
                </b>
                <i>
                  <em style={{ width: `${Math.min(100, g.pct)}%` }} />
                </i>
              </button>
            ))}
          </div>
        )}
        {expanded && (
          <div className="department-cards">
            {groups.map((g) => (
              <button
                type="button"
                className="dept-card dept-card-button"
                key={g.key}
                onClick={() => setSelectedDept(g)}
              >
                <div>
                  <b>{g.label}</b>
                  <span>
                    {g.members} employees <ChevronRight size={15} />
                  </span>
                </div>
                <strong>
                  {g.count}
                  <small> / {g.target}</small>
                </strong>
                <div className="mini-progress">
                  <i style={{ width: `${Math.min(100, g.pct)}%` }} />
                </div>
                <small>{g.pct}% annual target</small>
              </button>
            ))}
          </div>
        )}
      </div>
      {feedback}
      {selectedDept && (
        <DepartmentDrilldown
          group={
            getHistory
              ? selectedDept
              : groups.find((g) => g.key === selectedDept.key) || selectedDept
          }
          users={users}
          onOpen={onOpen}
          onClose={() => {
            cancelHistory();
            setSelectedDept(null);
          }}
        />
      )}
    </>
  );
}

export function PlantYearSummary({
  summary,
  user,
  users,
  reports,
  tracking,
}: {
  user: User;
  users: User[];
  reports: ESOReport[];
  tracking: TrackingData | null;
  summary?: DashboardSummary | null;
}) {
  const scopedUsers = user.plantId
      ? users.filter((u) => u.plantId === user.plantId)
      : users,
    scopedReports = user.plantId
      ? reports.filter((r) => r.plantId === user.plantId)
      : reports,
    activeUsers = scopedUsers.filter((u) => u.active),
    yearReports = scopedReports.filter((r) => inCurrentFY(r.createdAt)),
    target = activeUsers.reduce(
      (sum, u) => sum + Math.max(0, u.annualTarget || 0),
      0,
    ),
    reported = summary?.plantReported ?? yearReports.length,
    closed =
      summary?.plantClosed ??
      yearReports.filter(
        (r) => r.status === "Completed" || Boolean(r.completedAt),
      ).length,
    completionRate = reported
      ? Math.round((closed / reported) * 100)
      : tracking?.closureRates?.year.rate || 0,
    targetPct = target
      ? Math.min(100, Math.round((reported / target) * 100))
      : 0;
  return (
    <div className="plant-year-summary">
      <div className="plant-year-card plant-target-card">
        <div className="plant-year-card-head">
          <div>
            <span>PLANT ESO / ANNUAL TARGET</span>
            <h3>
              {user.plantName || "Plant"}{" "}
              <small>• FY {tracking?.year || fiscalYearInfo().label}</small>
            </h3>
          </div>
          <Target size={20} />
        </div>
        <div className="plant-year-value">
          <strong>{reported}</strong>
          <span>/ {target}</span>
        </div>
        <div className="plant-year-progress">
          <i style={{ width: `${targetPct}%` }} />
        </div>
        <small>
          {targetPct}% of annual target • {Math.max(0, target - reported)}{" "}
          remaining
        </small>
      </div>
      <div className="plant-year-card plant-closure-card">
        <div className="plant-year-card-head">
          <div>
            <span>PLANT CLOSURE RATE</span>
            <h3>
              Fiscal year{" "}
              <small>• {tracking?.year || fiscalYearInfo().label}</small>
            </h3>
          </div>
          <CheckCircle2 size={20} />
        </div>
        <div className="plant-year-value">
          <strong>{completionRate}%</strong>
          <span>
            {closed} closed / {reported} reported
          </span>
        </div>
        <div className="plant-year-progress">
          <i style={{ width: `${completionRate}%` }} />
        </div>
        <small>
          {Math.max(0, reported - closed)} open from this fiscal year's reports
        </small>
      </div>
    </div>
  );
}

export function DepartmentDrilldown({
  group,
  users,
  onOpen,
  onClose,
}: {
  group: any;
  users: User[];
  onOpen: (r: ESOReport) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(""),
    [filter, setFilter] = useState("All"),
    [category, setCategory] = useState("All");
  const list = (group.reports as ESOReport[]).filter((r) => {
    const u = users.find((x) => x.id === r.reporterId),
      hay = `${r.esoNo} ${r.location || ""} ${u?.name || ""}`.toLowerCase();
    return (
      hay.includes(q.toLowerCase()) &&
      (filter === "All" ||
        r.status === filter ||
        (filter === "Critical" && r.urgency === "Critical") ||
        (filter === "Overdue" && r.overdue)) &&
      (category === "All" || r.category === category)
    );
  });
  const open = group.reports.filter(
      (r: ESOReport) => r.status === "Open",
    ).length,
    progress = group.reports.filter(
      (r: ESOReport) => r.status === "In Progress",
    ).length,
    completed = group.reports.filter(
      (r: ESOReport) => r.status === "Completed",
    ).length;
  return (
    <div className="modal-backdrop department-modal-backdrop">
      <div className="modal department-drilldown">
        <div className="modal-head">
          <div>
            <h2>{group.label}</h2>
            <span>
              {group.members} employees • {group.count} ESO YTD
            </span>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">
          <div className="dept-summary">
            <div>
              <span>Total</span>
              <strong>{group.count}</strong>
            </div>
            <div>
              <span>Open</span>
              <strong>{open}</strong>
            </div>
            <div>
              <span>In Progress</span>
              <strong>{progress}</strong>
            </div>
            <div>
              <span>Completed</span>
              <strong>{completed}</strong>
            </div>
          </div>
          <div className="dept-drill-filters">
            <div className="search">
              <Search size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ESO…"
              />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
              <option value="Critical">Critical</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="All">All categories</option>
              <option value="Safety">Safety</option>
              <option value="Environmental">Environmental</option>
            </select>
          </div>
          <ReportsTable
            title={`ESO — ${group.label}`}
            reports={list}
            users={users}
            onOpen={onOpen}
          />
        </div>
      </div>
    </div>
  );
}

export type MonthlyTrackingPoint = {
  month: number;
  label: string;
  reported: number;
  resolved: number;
};

export type ResolverStat = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  role: string;
  resolvedYtd: number;
  resolvedThisMonth: number;
};

export type ReporterStat = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  role: string;
  reportedYtd: number;
  reportedThisMonth: number;
};

export type TrackingData = {
  year: number;
  currentMonth: number;
  monthly: MonthlyTrackingPoint[];
  reporterLeaderboard: ReporterStat[];
  resolverLeaderboard: ResolverStat[];
  closureRates?: ClosureRates;
};

export type HistoryLoader = () => Promise<ESOReport[]>;
export interface DashboardSummary {
  ytd: number;
  open: number;
  inProgress: number;
  completed: number;
  critical: number;
  overdue: number;
  plantReported: number;
  plantClosed: number;
  plantOverdue: Record<string, number>;
}
function useHistoryAction(getHistory: HistoryLoader) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true),
    request = useRef(0),
    last = useRef<((rows: ESOReport[]) => void) | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current++;
    };
  }, []);
  const runHistory = async (action: (rows: ESOReport[]) => void) => {
    const token = ++request.current;
    last.current = action;
    setBusy(true);
    setError("");
    try {
      const rows = await getHistory();
      if (active.current && token === request.current) action(rows);
    } catch (e) {
      if (active.current && token === request.current)
        setError((e as Error).message);
    } finally {
      if (active.current && token === request.current) setBusy(false);
    }
  };
  return {
    runHistory,
    refreshHistory: () => {
      if (last.current) void runHistory(last.current);
    },
    cancelHistory: () => {
      request.current++;
      setBusy(false);
      setError("");
    },
    feedback: busy ? (
      <LoadingStatus label="Loading report history…" />
    ) : error ? (
      <div className="form-error" role="alert">
        {error}
        <button
          className="outline-btn"
          onClick={() => last.current && void runHistory(last.current)}
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    ) : null,
  };
}



