"use client";
import { compareReportPriority } from "@/lib/report-priority";
import { cacheReportPage, readReportPage } from "@/lib/report-page-cache";

import LocalizedDate from "./localized-date";
import { X as ActionX } from "lucide-react";
import { Eye as ActionEye } from "lucide-react";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Search, Users, X, Star, MessageSquare } from "lucide-react";
import type { ESOReport, Location, User } from "@/types";
import { ReportWorkspace } from "@/components/eso-workflow";
import { localParts } from "@/lib/fiscal-year";
import { OpenReportLabel } from "@/components/i18n";
import { json, Badge, Detail, Block, canAdmin, canViewAll } from "./eso-shared";

export function ReportsTable({
  title,
  reports,
  users,
  onOpen,
  mobileTable = true,
  adminFilters = false,
  serverPaging = false,
  mineOnly = false,
  locations = [],
}: {
  title: string;
  reports: ESOReport[];
  users: User[];
  onOpen: (r: ESOReport) => void;
  mobileTable?: boolean;
  adminFilters?: boolean;
  serverPaging?: boolean;
  mineOnly?: boolean;
  locations?: Location[];
}) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("All"),
    [urg, setUrg] = useState("All"),
    [category, setCategory] = useState("All"),
    [department, setDepartment] = useState("All"),
    [location, setLocation] = useState("All"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [starsOnly, setStarsOnly] = useState(false);
  const departmentOptions = Array.from(
      new Set(users.map((u) => u.department).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b)),
    locationOptions = Array.from(
      new Set(
        (serverPaging
          ? locations.map((l) => l.name)
          : reports.map((r) => r.location)
        ).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  const dateKey = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const p = localParts(d);
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  };
  const localVisible = (serverPaging ? [] : reports)
    .filter((r) => {
      const u = users.find((x) => x.id === r.reporterId),
        s = q.trim().toLowerCase(),
        departmentName = u?.department || "",
        reportDate = dateKey(r.createdAt);
      return (
        (!s ||
          r.esoNo.toLowerCase().includes(s) ||
          u?.name?.toLowerCase().includes(s) ||
          u?.employeeId?.toLowerCase().includes(s) ||
          departmentName.toLowerCase().includes(s) ||
          r.location.toLowerCase().includes(s)) &&
        (status === "All" || r.status === status) &&
        (urg === "All" || r.urgency === urg) &&
        (category === "All" || r.category === category) &&
        (department === "All" || departmentName === department) &&
        (location === "All" || r.location === location) &&
        (!dateFrom || reportDate >= dateFrom) &&
        (!dateTo || reportDate <= dateTo) &&
        (!starsOnly || r.isStarred)
      );
    })
    .sort(compareReportPriority);
  const filterKey = JSON.stringify({
    q,
    status,
    urgency: urg,
    category,
    department,
    location,
    from: dateFrom,
    to: dateTo,
    stars: String(starsOnly),
    mine: String(mineOnly),
  });
  const [pageState, setPageState] = useState({ key: filterKey, index: 1 });
  const page = pageState.key === filterKey ? pageState.index : 1;
  const [remote, setRemote] = useState<{ reports: ESOReport[]; total: number }>(
    { reports: [], total: 0 },
  );
  const [busy, setBusy] = useState(serverPaging),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!serverPaging) return;
    const params = new URLSearchParams({ ...JSON.parse(filterKey), page: String(page) });
    const cacheKey = params.toString();
    const cached = readReportPage(reports, cacheKey);
    if (cached) {
      setRemote(cached);
      setBusy(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setBusy(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const data = await json("/api/reports/page?" + params, {
          signal: controller.signal,
        });
        if (!cancelled) {
          if (page > 1 && data.total <= (page - 1) * 50) {
            setPageState({
              key: filterKey,
              index: Math.max(1, Math.ceil(data.total / 50)),
            });
            return;
          }
          setRemote(data);
          cacheReportPage(reports, cacheKey, data);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, JSON.parse(filterKey).q ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [serverPaging, filterKey, page, retry, reports]);
  const visible = serverPaging ? remote.reports : localVisible;
  const total = serverPaging ? remote.total : visible.length;
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <span>{total} records • priority first</span>
      </div>
      {adminFilters && (
        <div className="filters report-filters">
          <div className="search">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ESO, employee, location…"
            />
          </div>
          <label className="filter-date" onClick={(event) => {
            const input = event.currentTarget.querySelector("input");
            if (!input) return;
            if (typeof input.showPicker === "function") {
              event.preventDefault();
              input.focus();
              try { input.showPicker(); } catch { /* Native input remains keyboard accessible. */ }
            } else { input.focus(); }
          }}>
            <span>From</span>
            <input
              type="date"
              aria-label="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="filter-date" onClick={(event) => {
            const input = event.currentTarget.querySelector("input");
            if (!input) return;
            if (typeof input.showPicker === "function") {
              event.preventDefault();
              input.focus();
              try { input.showPicker(); } catch { /* Native input remains keyboard accessible. */ }
            } else { input.focus(); }
          }}>
            <span>To</span>
            <input
              type="date"
              aria-label="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="All">All departments</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="All">All locations</option>
            {locationOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <select value={urg} onChange={(e) => setUrg(e.target.value)}>
            <option value="All">All urgency</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
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
          <button
            type="button"
            className={`star-filter ${starsOnly ? "active" : ""}`}
            onClick={() => setStarsOnly((v) => !v)}
            aria-label="ESO Stars"
            aria-pressed={starsOnly}
            title="ESO Stars"
          >
            <Star
              size={16}
              aria-hidden="true"
              fill={starsOnly ? "currentColor" : "none"}
            />{" "}
            ESO Stars
          </button>
        </div>
      )}
      {serverPaging && error && (
        <div className="form-error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="outline-small"
            onClick={() => setRetry((v) => v + 1)}
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}
      {serverPaging && busy && <p className="reports-loading" role="status">Loading reports…</p>}
      <div
        className={`table-wrap reports-table${mobileTable ? " reports-table-scroll" : ""}`}
        tabIndex={mobileTable ? 0 : undefined}
        aria-busy={serverPaging && busy}
        style={
          serverPaging && (busy || error) ? { display: "none" } : undefined
        }
      >
        <table>
          <thead>
            <tr>
              <th>ESO #</th>
              <th>Employee</th>
              <th>Plant</th>
              <th>Department</th>
              <th>Date</th>
              <th>Location</th>
              <th>Urgency</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const u = users.find((x) => x.id === r.reporterId),
                assigned = users.find((x) => x.id === r.assignedTo),
                completedBy =
                  r.status === "Completed"
                    ? r.resolvedByName ||
                      users.find((x) => x.id === r.resolvedBy)?.name ||
                      "Not recorded"
                    : null,
                overdueBy = r.overdue
                  ? r.assignedToName || assigned?.name || "Not assigned"
                  : null,
                inProgressBy =
                  r.status === "In Progress"
                    ? r.assignedToName || assigned?.name || "Not assigned"
                    : null,
                inProgressRole = r.assignedToRole || assigned?.role;
              return (
                <tr key={r.id} className={r.isStarred ? "starred-row" : ""}>
                  <td data-label="ESO #">
                    <b>
                      {r.isStarred && (
                        <Star
                          className="eso-star-inline"
                          size={15}
                          fill="currentColor"
                        />
                      )}
                      {r.esoNo}
                    </b>
                    {(r.starCount || 0) > 0 && (
                      <small className="star-count-cell">
                        {r.starCount} {r.starCount === 1 ? "STAR" : "STARS"}
                      </small>
                    )}
                  </td>
                  <td data-label="Employee">
                    {u?.name || "—"}
                    <small>ID {u?.employeeId || "—"}</small>
                    {completedBy && (
                      <small className="completed-by-cell">
                        Completed by: {completedBy}
                      </small>
                    )}
                    {overdueBy && (
                      <small className="overdue-by-cell">
                        Overdue by: {overdueBy}
                      </small>
                    )}
                  </td>
                  <td data-label="Plant">
                    {r.plantName || u?.plantName || "—"}
                  </td>
                  <td data-label="Department">{u?.department || "—"}</td>
                  <td data-label="Date">
                    {<LocalizedDate value={r.createdAt} format="date"/>}
                  </td>
                  <td data-label="Location" data-no-translate>{r.location}</td>
                  <td data-label="Urgency">
                    <Badge text={r.urgency} />
                  </td>
                  <td data-label="Status">
                    <Badge text={r.status} />
                    {inProgressBy && (
                      <small className="assigned-to-cell">
                        Assigned To: {inProgressBy}
                        {inProgressRole ? ` • ${inProgressRole}` : ""}
                      </small>
                    )}
                  </td>
                  <td data-label="">
                    <button className="outline-small" onClick={() => onOpen(r)}>
                      <ActionEye
                        size={16}
                        aria-hidden="true"
                        className="action-icon"
                      />
                      <OpenReportLabel />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {serverPaging && (
        <nav className="report-pagination" aria-label="Report pages">

          <button
            type="button"
            className="outline-btn"
            disabled={busy || page === 1}
            onClick={() => setPageState({ key: filterKey, index: page - 1 })}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span>
            {total ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} /{" "}
            {total}
          </span>
          <button
            type="button"
            className="outline-btn"
            disabled={busy || page * 50 >= total}
            onClick={() => setPageState({ key: filterKey, index: page + 1 })}
          >
            Next <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

export function ReportModal({
  report,
  users,
  locations,
  currentUser,
  onChanged,
  onClose,
}: {
  report: ESOReport;
  users: User[];
  locations: Location[];
  currentUser: User;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const u = users.find((x) => x.id === report.reporterId),
    m = users.find((x) => x.id === report.assignedTo),
    resolver = users.find((x) => x.id === report.resolvedBy);
  const [starBusy, setStarBusy] = useState(false),
    [starError, setStarError] = useState(""),
    [reclassOpen, setReclassOpen] = useState(false),
    [reclassCategory, setReclassCategory] = useState("other"),
    [reclassReason, setReclassReason] = useState(""),
    [reclassBusy, setReclassBusy] = useState(false),
    [resolverOpen, setResolverOpen] = useState(false),
    [resolverId, setResolverId] = useState(report.resolvedBy || ""),
    [resolverBusy, setResolverBusy] = useState(false);
  const assignedName = m?.name || report.assignedToName,
    assignedRole = m?.role || report.assignedToRole,
    resolverName = resolver?.name || report.resolvedByName,
    resolverRole = resolver?.role || report.resolvedByRole,
    canStar = canViewAll(currentUser.role),
    canAttribute = canAdmin(currentUser.role),
    resolverOptions = users.filter(
      (x) => x.active && (!report.plantId || x.plantId === report.plantId),
    );
  const starCount = report.starCount ?? (report.isStarred ? 1 : 0),
    starredByMe =
      report.starredByMe ??
      Boolean(report.isStarred && report.starredBy === currentUser.id);
  const toggleStar = async () => {
    setStarBusy(true);
    setStarError("");
    try {
      await json("/api/reports/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          version: report.revision,
          starred: !starredByMe,
        }),
      });
      await onChanged();
    } catch (e: any) {
      setStarError(e.message);
    } finally {
      setStarBusy(false);
    }
  };
  const reclassify = async () => {
    if (!reclassReason.trim()) return;
    setReclassBusy(true);
    setStarError("");
    try {
      await json("/api/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          esoId: report.id,
          version: report.revision,
          reason: reclassReason.trim(),
          category: reclassCategory,
        }),
      });
      setReclassOpen(false);
      setReclassReason("");
      setReclassCategory("other");
      await onChanged();
    } catch (e: any) {
      setStarError(e.message);
    } finally {
      setReclassBusy(false);
    }
  };
  const setCompletionResolver = async () => {
    if (!resolverId) return;
    setResolverBusy(true);
    setStarError("");
    try {
      await json("/api/reports/completion-resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          version: report.revision,
          resolverId,
        }),
      });
      setResolverOpen(false);
      await onChanged();
    } catch (e: any) {
      setStarError(e.message);
    } finally {
      setResolverBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>
              {starCount > 0 && (
                <Star
                  className="eso-star-title"
                  size={20}
                  fill="currentColor"
                />
              )}
              {report.esoNo}
            </h2>
            <span>ESO Details</span>
          </div>
          <Badge text={report.urgency} />
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">
          {starCount > 0 && (
            <div className="eso-star-banner">
              <Star size={20} fill="currentColor" />
              <div>
                <b>
                  ESO Star • {starCount} {starCount === 1 ? "star" : "stars"}
                </b>
                <span>
                  Recognized as a valuable ESO
                  {report.starredByName ? ` by ${report.starredByName}` : ""}
                  {report.starredAt && <> • <LocalizedDate value={report.starredAt}/></>}
                </span>
              </div>
            </div>
          )}
          {(canStar || (canAttribute && report.status === "Completed")) && (
            <div className="star-actions">
              {canStar && (
                <>
                  <button
                    className={
                      starredByMe ? "remove-star-btn" : "award-star-btn"
                    }
                    onClick={toggleStar}
                    disabled={starBusy}
                  >
                    <Star
                      size={17}
                      fill={starredByMe ? "currentColor" : "none"}
                    />
                    {starBusy
                      ? "SAVING…"
                      : starredByMe
                        ? "REMOVE MY STAR"
                        : <><span className="star-label-full">ADD ESO STAR</span><span className="star-label-compact">ADD ESO</span></>}
                  </button>
                  <button
                    className="reclassify-btn"
                    onClick={() => setReclassOpen(true)}
                  >
                    <MessageSquare size={17} /> MOVE TO VOE
                  </button>
                </>
              )}
              {canAttribute && report.status === "Completed" && (
                <button
                  className="completion-resolver-btn"
                  onClick={() => {
                    setResolverId(report.resolvedBy || "");
                    setResolverOpen(true);
                  }}
                >
                  <Users size={17} />
                  {resolverName ? "EDIT COMPLETED BY" : "SET COMPLETED BY"}
                </button>
              )}
            </div>
          )}
          {starError && <div className="form-error">{starError}</div>}
          <div className="detail-grid">
            <Detail
              l="Reporter"
              v={`${u?.name || ""} • ID ${u?.employeeId || ""}`}
            />
            <Detail
              l="Date & Time"
              v={<LocalizedDate value={report.createdAt} format="dateTime"/>}
            />
            <Detail l="Department" v={u?.department || "—"} />
            {report.plantName && <Detail l="Plant" v={report.plantName} />}
            <Detail l="Status" v={report.status} />
            <Detail l="ESO Stars" v={String(starCount)} />
            <Detail l="Location" v={report.location} />
            <Detail
              l="Assigned To"
              v={
                assignedName
                  ? `${assignedName}${assignedRole ? ` • ${assignedRole}` : ""}`
                  : "Not assigned"
              }
            />
          </div>
          {report.dueAt && (
            <div className={`resolved-at-summary due-date-summary${report.overdue ? " is-overdue" : ""}`}>
              <Detail l="Due Date" v={<LocalizedDate value={report.dueAt}/>} />
              {report.overdue && <span className="due-date-overdue">{`OVERDUE ${report.overdueDays}d`}</span>}
            </div>
          )}
          {(report.status === "Completed" || report.completedAt) && (
            <div className="resolved-at-summary completion-summary">
              <Detail
                l="Resolved By"
                v={resolverName
                  ? `${resolverName}${resolverRole ? ` • ${resolverRole}` : ""}`
                  : "Not recorded"}
              />
              {report.completedAt && <Detail
                l="Resolved At"
                v={<LocalizedDate value={report.completedAt} format="dateTime"/>}
              />}
            </div>
          )}
          <Block className="problem-description" l="Problem Description" v={report.description} />
          <Block
            className="corrective-action-panel"
            l="Corrective Action"
            v={report.correctiveAction || "No corrective action recorded yet."}
          />
          <ReportWorkspace
            users={users}
            report={report}
            currentUser={currentUser}
            locations={locations}
            onChanged={onChanged}
          />
        </div>
      </div>
      {reclassOpen && (
        <div
          className="modal-backdrop reclassify-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !reclassBusy)
              setReclassOpen(false);
          }}
        >
          <div className="small-modal reclassify-modal">
            <div className="reclassify-modal-head">
              <div>
                <h3>Move to Voice of Employee</h3>
                <p>Reclassify this ESO without deleting its history.</p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setReclassOpen(false)}
                disabled={reclassBusy}
              >
                <X size={20} />
              </button>
            </div>
            <label>
              Category
              <select
                value={reclassCategory}
                onChange={(e) => setReclassCategory(e.target.value)}
              >
                <option value="workplace_conditions">
                  Workplace &amp; Working Conditions
                </option>
                <option value="compensation_benefits">
                  Compensation &amp; Benefits
                </option>
                <option value="process_improvement">Process Improvement</option>
                <option value="equipment_tools">Equipment &amp; Tools</option>
                <option value="work_organization">Work Organization</option>
                <option value="management_communication">
                  Management &amp; Communication
                </option>
                <option value="employee_wellbeing">Employee Wellbeing</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Reason for reclassification
              <textarea
                rows={4}
                value={reclassReason}
                onChange={(e) => setReclassReason(e.target.value)}
                placeholder="Explain why this report is being moved to Voice of Employee…"
              />
            </label>
            <div className="form-actions">
              <button
                className="outline-btn"
                onClick={() => setReclassOpen(false)}
                disabled={reclassBusy}
              >
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                CANCEL
              </button>
              <button
                className="primary-btn"
                onClick={reclassify}
                disabled={reclassBusy || !reclassReason.trim()}
              >
                <MessageSquare size={17} />
                {reclassBusy ? "MOVING…" : "MOVE TO VOE"}
              </button>
            </div>
          </div>
        </div>
      )}
      {resolverOpen && (
        <div
          className="modal-backdrop reclassify-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !resolverBusy)
              setResolverOpen(false);
          }}
        >
          <form
            className="small-modal reclassify-modal"
            onSubmit={(e) => {
              e.preventDefault();
              void setCompletionResolver();
            }}
          >
            <div className="reclassify-modal-head">
              <div>
                <h3>Set Completed By</h3>
                <p>
                  Use this when the ESO was completed outside the app. The
                  completion status and date stay unchanged.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setResolverOpen(false)}
                disabled={resolverBusy}
              >
                <X size={20} />
              </button>
            </div>
            <label>
              Completed by
              <select
                required
                value={resolverId}
                onChange={(e) => setResolverId(e.target.value)}
              >
                <option value="">Select employee</option>
                {resolverOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} • {x.role}
                    {x.employeeId ? ` • ID ${x.employeeId}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => setResolverOpen(false)}
                disabled={resolverBusy}
              >
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                CANCEL
              </button>
              <button
                className="primary-btn"
                disabled={resolverBusy || !resolverId}
              >
                <Users size={17} />
                {resolverBusy ? "SAVING…" : "SAVE COMPLETED BY"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}





