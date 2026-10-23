"use client";
import {
  CheckCheck as ActionCheckCheck,
  X as ActionX,
  Save as ActionSave,
  Target as ActionTarget,
  Upload as ActionUpload,
  Pencil as ActionPencil,
  Power as ActionPower,
} from "lucide-react";
import { FormEvent, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import type {
  Department,
  ESOReport,
  Location,
  Plant,
  Role,
  User,
} from "@/types";
import { fiscalYearInfo, inCurrentFY, localParts } from "@/lib/fiscal-year";
import { json, Title, Badge, canAdmin } from "./eso-shared";
import { DepartmentPerformance } from "./eso-dashboard";

export function Employees({
  currentUser,
  users,
  reports,
  departments,
  plants,
  reload,
}: {
  currentUser: User;
  users: User[];
  reports: ESOReport[];
  departments: Department[];
  plants: Plant[];
  reload: () => Promise<void>;
}) {
  const [dept, setDept] = useState("All"),
    [plantFilter, setPlantFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [showInactive, setShowInactive] = useState(false),
    [show, setShow] = useState(false),
    [edit, setEdit] = useState<User | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [importFile, setImportFile] = useState<File | null>(null),
    [importResult, setImportResult] = useState<any>(null),
    [bulkTargetOpen, setBulkTargetOpen] = useState(false),
    [bulkTarget, setBulkTarget] = useState(24),
    [bulkUpdated, setBulkUpdated] = useState<number | null>(null),
    [bulkError, setBulkError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    plantId: currentUser.plantId || plants[0]?.id || "",
    department:
      departments.find(
        (d) => d.plantId === (currentUser.plantId || plants[0]?.id),
      )?.name || "",
    role: "Employee" as Role,
    password: "",
    annualTarget: 12,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    plantId: "",
    department: "",
    role: "Employee" as Role,
    newPassword: "",
    annualTarget: 12,
  });
  const normalizedQuery = query.trim().toLowerCase();
  const emps = users.filter(
    (u) =>
      (showInactive || u.active) &&
      (plantFilter === "All" || u.plantId === plantFilter) &&
      (dept === "All" || u.department === dept) &&
      (!normalizedQuery ||
        u.name.toLowerCase().includes(normalizedQuery) ||
        String(u.employeeId).toLowerCase().includes(normalizedQuery)),
  );
  const roleOptions = (
    currentUser.role === "Super Admin"
      ? [
          "Employee",
          "Maintenance",
          "Supervisor",
          "Management",
          "Admin",
          "Super Admin",
        ]
      : ["Employee", "Maintenance", "Supervisor", "Management", "Admin"]
  ) as Role[];
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await json("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShow(false);
      setForm({ ...form, employeeId: "", name: "", password: "" });
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const openEdit = (u: User) => {
    setEdit(u);
    setEditForm({
      name: u.name,
      plantId: u.plantId || currentUser.plantId || "",
      department: u.department,
      role: u.role,
      newPassword: "",
      annualTarget: u.annualTarget,
    });
    setError("");
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setError("");
    if (
      edit.role === "Employee" &&
      editForm.role !== "Employee" &&
      editForm.newPassword.length < 6
    ) {
      setError(
        "Set an initial password of at least 8 characters for the new privileged role.",
      );
      return;
    }
    setBusy(true);
    try {
      await json("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edit.id, ...editForm }),
      });
      setEdit(null);
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !edit ||
      !confirm(
        `Deactivate ${edit.name}? The user will no longer be able to log in, while historical ESO records remain.`,
      )
    )
      return;
    setError("");
    try {
      await json("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edit.id }),
      });
      setEdit(null);
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const importEmployees = async () => {
    if (!importFile) return;
    setBusy(true);
    setImportResult(null);
    setError("");
    try {
      const fd = new FormData();
      fd.set("file", importFile);
      const r = await json("/api/employees/import", {
        method: "POST",
        body: fd,
      });
      setImportResult(r);
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const bulkScope =
    currentUser.role === "Super Admin"
      ? "all active users in this company"
      : "all active non-Super-Admin users in my plant";
  const bulkScopeCount = users.filter(
    (u) =>
      u.active &&
      (currentUser.role === "Super Admin" ||
        (u.plantId === currentUser.plantId && u.role !== "Super Admin")),
  ).length;
  const openBulkTarget = () => {
    setBulkTarget(24);
    setBulkUpdated(null);
    setBulkError("");
    setBulkTargetOpen(true);
  };
  const updateBulkTarget = async (e: FormEvent) => {
    e.preventDefault();
    setBulkError("");
    setBusy(true);
    try {
      const result = await json("/api/employees/bulk-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: bulkTarget }),
      });
      setBulkUpdated(result.updated || 0);
      await reload();
    } catch (e: any) {
      setBulkError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <Title
        title="Employee Tracker"
        subtitle={`${new Date().getFullYear()} ESO target performance`}
      />
      <div className="toolbar employee-tracker-toolbar">
        <div className="employee-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee by name or ID…"
            aria-label="Search employee by name or ID"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {currentUser.role === "Super Admin" && (
          <select
            value={plantFilter}
            onChange={(e) => {
              setPlantFilter(e.target.value);
              setDept("All");
            }}
          >
            <option value="All">All plants</option>
            {plants
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id} data-no-translate>
                  {p.name}
                </option>
              ))}
          </select>
        )}
        <select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="All">All</option>
          {departments
            .filter(
              (d) =>
                d.active &&
                (plantFilter === "All" || d.plantId === plantFilter),
            )
            .map((d) => (
              <option key={d.id} value={d.name} data-no-translate>{d.name}</option>
            ))}
        </select>
        <label className="show-inactive">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />{" "}
          Show inactive users
        </label>
        {canAdmin(currentUser.role) && (
          <>
            <button className="outline-btn compact" onClick={openBulkTarget}>
              <Target size={17} /> SET ALL TARGETS
            </button>
            <button
              className="outline-btn compact"
              onClick={() => {
                setImportOpen(true);
                setError("");
                setImportResult(null);
              }}
            >
              <FileSpreadsheet size={17} /> IMPORT EXCEL
            </button>
            <button
              className="primary-btn compact"
              onClick={() => {
                setShow(true);
                setError("");
              }}
            >
              <Plus size={17} /> ADD USER
            </button>
          </>
        )}
      </div>
      <div className="panel">
        <div className="employee-result-count">
          {emps.length} {emps.length === 1 ? "employee" : "employees"} found
        </div>
        <EmployeeTable
          users={emps}
          reports={reports}
          canEdit={canAdmin(currentUser.role)}
          onEdit={openEdit}
        />
      </div>
      {show && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={add}>
            <h3>Add Employee / User</h3>
            <label>
              Employee ID
              <input
                required
                value={form.employeeId}
                onChange={(e) =>
                  setForm({ ...form, employeeId: e.target.value })
                }
              />
            </label>
            <label>
              Full Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            {currentUser.role === "Super Admin" && (
              <label>
                Plant
                <select
                  value={form.plantId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setForm({
                      ...form,
                      plantId: pid,
                      department:
                        departments.find((d) => d.active && d.plantId === pid)
                          ?.name || "",
                    });
                  }}
                >
                  {plants
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id} data-no-translate>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Department
              <select
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              >
                {departments
                  .filter(
                    (d) =>
                      d.active && (!form.plantId || d.plantId === form.plantId),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.name} data-no-translate>{d.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as Role })
                }
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Annual ESO Target
              <input
                type="number"
                min={0}
                value={form.annualTarget}
                onChange={(e) =>
                  setForm({ ...form, annualTarget: Number(e.target.value) })
                }
              />
            </label>
            {form.role !== "Employee" && (
              <label>
                Initial Password
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </label>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => setShow(false)}
              >
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Cancel
              </button>
              <button className="primary-btn" disabled={busy}>
                <ActionSave
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                Add User
              </button>
            </div>
          </form>
        </div>
      )}
      {edit && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={save}>
            <h3>Edit User</h3>
            <p>
              ID {edit.employeeId} • {edit.active ? "Active" : "Inactive"}
            </p>
            <label>
              Full Name
              <input
                autoFocus
                required
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </label>
            {currentUser.role === "Super Admin" && (
              <label>
                Plant
                <select
                  value={editForm.plantId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setEditForm({
                      ...editForm,
                      plantId: pid,
                      department:
                        departments.find((d) => d.active && d.plantId === pid)
                          ?.name || "",
                    });
                  }}
                >
                  {plants
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id} data-no-translate>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Department
              <select
                value={editForm.department}
                onChange={(e) =>
                  setEditForm({ ...editForm, department: e.target.value })
                }
              >
                {departments
                  .filter(
                    (d) =>
                      d.active &&
                      (!editForm.plantId || d.plantId === editForm.plantId),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.name} data-no-translate>{d.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Role
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value as Role })
                }
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Annual ESO Target
              <input
                type="number"
                min={0}
                value={editForm.annualTarget}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    annualTarget: Number(e.target.value),
                  })
                }
              />
            </label>
            {editForm.role !== "Employee" && (
              <label>
                Set / Reset Password{" "}
                <small>(leave blank to keep current)</small>
                <input
                  minLength={8}
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) =>
                    setEditForm({ ...editForm, newPassword: e.target.value })
                  }
                />
              </label>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="danger-zone">
              <button type="button" className="danger-btn" onClick={remove}>
                <Trash2 size={16} /> DELETE USER
              </button>
              <small>
                User is removed from active lists and login is disabled;
                historical ESO records stay linked.
              </small>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => setEdit(null)}
              >
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Cancel
              </button>
              <button className="primary-btn" disabled={busy}>
                <ActionSave
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
      {bulkTargetOpen && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={updateBulkTarget}>
            <h3>Set Annual Target for Everyone</h3>
            {bulkUpdated === null ? (
              <>
                <p>
                  This changes the annual ESO target for {bulkScopeCount}{" "}
                  {bulkScope}. Inactive users remain unchanged.
                </p>
                <label>
                  Annual ESO target
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    required
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(Number(e.target.value))}
                  />
                </label>
                <div className="form-error">
                  Confirm that you want to set the target to {bulkTarget} for{" "}
                  {bulkScope}.
                </div>
                {bulkError && <div className="form-error">{bulkError}</div>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setBulkTargetOpen(false)}
                    disabled={busy}
                  >
                    <ActionX
                      size={16}
                      aria-hidden="true"
                      className="action-icon"
                    />
                    Cancel
                  </button>
                  <button className="primary-btn" disabled={busy}>
                    <ActionTarget
                      size={16}
                      aria-hidden="true"
                      className="action-icon"
                    />
                    {busy ? "UPDATING…" : "SET TARGET FOR ALL"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="success-box">
                  Annual target set to {bulkTarget} for {bulkUpdated} active
                  users.
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => setBulkTargetOpen(false)}
                  >
                    <ActionCheckCheck
                      size={16}
                      aria-hidden="true"
                      className="action-icon"
                    />
                    Done
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
      {importOpen && (
        <div className="modal-backdrop">
          <div className="small-modal">
            <h3>Bulk Employee Import</h3>
            <p>
              Upload an .xlsx file. Existing Employee IDs are updated; new IDs
              are created.
            </p>
            <a className="outline-btn" href="/api/employees/template">
              <Download size={16} /> DOWNLOAD TEMPLATE
            </a>
            <label>
              Excel File
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </label>
            {importResult && (
              <div className="import-result">
                <b>
                  {importResult.imported} added • {importResult.updated} updated
                </b>
                {importResult.errors?.length > 0 && (
                  <>
                    <small>
                      {importResult.errors.length} rows need attention
                    </small>
                    <div className="import-errors">
                      {importResult.errors.slice(0, 8).map((x: any) => (
                        <div key={x.row}>
                          Row {x.row}: {x.error}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button
                className="outline-btn"
                onClick={() => setImportOpen(false)}
              >
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Close
              </button>
              <button
                className="primary-btn"
                disabled={!importFile || busy}
                onClick={importEmployees}
              >
                <ActionUpload
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                {busy ? "IMPORTING…" : "IMPORT EMPLOYEES"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmployeeTable({
  users,
  reports,
  canEdit = false,
  onEdit,
}: {
  users: User[];
  reports: ESOReport[];
  canEdit?: boolean;
  onEdit?: (u: User) => void;
}) {
  const fy = fiscalYearInfo(),
    expected = ((localParts(new Date()).month + 2) % 12) + 1;
  return (
    <div className="table-wrap employee-table">
      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Employee</th>
            <th>Role</th>
            <th>Plant</th>
            <th>Department</th>
            <th>ESO YTD</th>
            <th>Annual Target</th>
            <th>Progress</th>
            <th>Remaining</th>
            <th>Status</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const count = reports.filter(
                (r) => r.reporterId === u.id && inCurrentFY(r.createdAt),
              ).length,
              pct = u.annualTarget
                ? Math.round((count / u.annualTarget) * 100)
                : 100,
              status =
                count >= u.annualTarget
                  ? "Target Achieved"
                  : count >= expected
                    ? "On Track"
                    : "Behind Target";
            return (
              <tr key={u.id}>
                <td data-label="ID">
                  <b data-no-translate>{u.employeeId}</b>
                </td>
                <td data-label="Employee" data-no-translate>{u.name}</td>
                <td data-label="Role">{u.role}</td>
                <td data-label="Plant">{u.plantName || "—"}</td>
                <td data-label="Department" data-no-translate>{u.department}</td>
                <td data-label="ESO YTD">{count}</td>
                <td data-label="Target">{u.annualTarget}</td>
                <td data-label="Progress">
                  <div className="employee-progress-value"><div className="mini-progress">
                    <i style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <small>{pct}%</small></div>
                </td>
                <td data-label="Remaining">
                  {Math.max(0, u.annualTarget - count)}
                </td>
                <td data-label="Status">
                  <Badge text={status} />
                </td>
                {canEdit && (
                  <td>
                    <button
                      className="outline-small"
                      onClick={() => onEdit?.(u)}
                    >
                      <ActionPencil
                        size={16}
                        aria-hidden="true"
                        className="action-icon"
                      />
                      EDIT USER
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Departments({
  currentUser,
  departments,
  users,
  reports,
  plants,
  reload,
  onOpen,
}: {
  currentUser: User;
  departments: Department[];
  users: User[];
  reports: ESOReport[];
  plants: Plant[];
  reload: () => Promise<void>;
  onOpen: (r: ESOReport) => void;
}) {
  const [show, setShow] = useState(false),
    [edit, setEdit] = useState<Department | null>(null),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      name: "",
      code: "",
      plantId: currentUser.plantId || plants[0]?.id || "",
    });
  const reset = () => {
    setShow(false);
    setEdit(null);
    setError("");
    setForm({
      name: "",
      code: "",
      plantId: currentUser.plantId || plants[0]?.id || "",
    });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await json("/api/departments", {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit ? { id: edit.id, ...form } : form),
      });
      reset();
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const toggle = async (d: Department) => {
    setError("");
    try {
      await json("/api/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, active: !d.active }),
      });
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div className="page">
      <div className="dashboard-heading">
        <Title
          title="Departments"
          subtitle="Organize ESO performance by department"
        />
        <button
          className="primary-btn compact"
          onClick={() => {
            setEdit(null);
            setForm({
              name: "",
              code: "",
              plantId: currentUser.plantId || plants[0]?.id || "",
            });
            setError("");
            setShow(true);
          }}
        >
          <Plus size={17} /> ADD DEPARTMENT
        </button>
      </div>
      <DepartmentPerformance users={users} reports={reports} onOpen={onOpen} />
      <div className="panel">
        <div className="panel-head">
          <h3>Department Database</h3>
          <span>
            {departments.filter((d) => d.active).length} active •{" "}
            {departments.length} total
          </span>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="department-list">
          {departments.map((d) => (
            <div className="department-row" key={d.id}>
              <div className="department-main">
                <b data-no-translate>{d.name}</b>
                <small>
                  {plants.find((p) => p.id === d.plantId)?.name ||
                    currentUser.plantName ||
                    ""}
                  {d.code ? ` • ${d.code}` : ""}
                </small>
              </div>
              <Badge text={d.active ? "Active" : "Inactive"} />
              <div className="department-actions">
                <button
                  className="outline-small"
                  onClick={() => {
                    setEdit(d);
                    setForm({
                      name: d.name,
                      code: d.code || "",
                      plantId: d.plantId || currentUser.plantId || "",
                    });
                    setError("");
                    setShow(false);
                  }}
                >
                  <ActionPencil
                    size={16}
                    aria-hidden="true"
                    className="action-icon"
                  />
                  EDIT
                </button>
                <button className="outline-small" onClick={() => toggle(d)}>
                  <ActionPower
                    size={16}
                    aria-hidden="true"
                    className="action-icon"
                  />
                  {d.active ? "DEACTIVATE" : "ACTIVATE"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {(show || edit) && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={submit}>
            <h3>{edit ? "Edit Department" : "Add Department"}</h3>
            <p>
              Departments are scoped to a plant and used for employee grouping,
              location ownership and KPI reporting.
            </p>
            {currentUser.role === "Super Admin" && !edit && (
              <label>
                Plant
                <select
                  value={form.plantId}
                  onChange={(e) =>
                    setForm({ ...form, plantId: e.target.value })
                  }
                >
                  {plants
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id} data-no-translate>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Department Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Production Engineering"
              />
            </label>
            <label>
              Department Code <small>(optional)</small>
              <input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g. ENG"
                maxLength={20}
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="outline-btn" onClick={reset}>
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Cancel
              </button>
              <button className="primary-btn">
                <ActionSave
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                {edit ? "Save Changes" : "Add Department"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function Locations({
  currentUser,
  locations,
  departments,
  plants,
  reload,
}: {
  currentUser: User;
  locations: Location[];
  departments: Department[];
  plants: Plant[];
  reload: () => Promise<void>;
}) {
  const [show, setShow] = useState(false),
    [edit, setEdit] = useState<Location | null>(null),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      name: "",
      departmentId: "",
      plantId: currentUser.plantId || plants[0]?.id || "",
    });
  const depName = (id?: string | null) =>
    departments.find((d) => d.id === id)?.name || "—";
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await json("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShow(false);
      setForm({
        name: "",
        departmentId: "",
        plantId: currentUser.plantId || plants[0]?.id || "",
      });
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setError("");
    try {
      await json("/api/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          name: form.name,
          departmentId: form.departmentId,
          plantId: form.plantId,
        }),
      });
      setEdit(null);
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const toggle = async (l: Location) => {
    await json("/api/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id, active: l.active === false }),
    });
    await reload();
  };
  return (
    <div className="page">
      <div className="dashboard-heading">
        <Title title="Locations" subtitle="Manage ESO reporting locations" />
        <button
          className="primary-btn compact"
          onClick={() => {
            setForm({
              name: "",
              departmentId: "",
              plantId: currentUser.plantId || plants[0]?.id || "",
            });
            setError("");
            setShow(true);
          }}
        >
          <Plus size={17} /> ADD LOCATION
        </button>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Location Database</h3>
          <span>
            {locations.filter((l) => l.active !== false).length} active
          </span>
        </div>
        <div className="location-list">
          {locations.map((l) => (
            <div className="location-row" key={l.id}>
              <div>
                <b data-no-translate>{l.name}</b>
                <small>
                  {l.plantName ? `${l.plantName} • ` : ""}
                  {l.departmentName || depName(l.departmentId)}
                </small>
              </div>
              <Badge text={l.active === false ? "Inactive" : "Active"} />
              <div>
                <button
                  className="outline-small"
                  onClick={() => {
                    setEdit(l);
                    setForm({
                      name: l.name,
                      departmentId: l.departmentId || "",
                      plantId: l.plantId || currentUser.plantId || "",
                    });
                    setError("");
                  }}
                >
                  <ActionPencil
                    size={16}
                    aria-hidden="true"
                    className="action-icon"
                  />
                  EDIT
                </button>
                <button className="outline-small" onClick={() => toggle(l)}>
                  <ActionPower
                    size={16}
                    aria-hidden="true"
                    className="action-icon"
                  />
                  {l.active === false ? "ACTIVATE" : "DEACTIVATE"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {(show || edit) && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={edit ? save : add}>
            <h3>{edit ? "Edit Location" : "Add Location"}</h3>
            {currentUser.role === "Super Admin" && !edit && (
              <label>
                Plant
                <select
                  value={form.plantId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      plantId: e.target.value,
                      departmentId: "",
                    })
                  }
                >
                  {plants
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id} data-no-translate>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Location Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Assembly Line 4"
              />
            </label>
            <label>
              Department <small>(optional)</small>
              <select
                value={form.departmentId}
                onChange={(e) =>
                  setForm({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">No department</option>
                {departments
                  .filter(
                    (d) =>
                      d.active && (!form.plantId || d.plantId === form.plantId),
                  )
                  .map((d) => (
                    <option value={d.id} key={d.id} data-no-translate>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => {
                  setShow(false);
                  setEdit(null);
                }}
              >
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Cancel
              </button>
              <button className="primary-btn">
                <ActionSave
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                {edit ? "Save Changes" : "Add Location"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function Plants({
  currentUser,
  plants,
  corporatePlants,
  reload,
}: {
  currentUser: User;
  plants: Plant[];
  corporatePlants: any[];
  reload: () => Promise<void>;
}) {
  const [show, setShow] = useState(false),
    [edit, setEdit] = useState<Plant | null>(null),
    [error, setError] = useState(""),
    [withAdmin, setWithAdmin] = useState(true),
    [form, setForm] = useState({
      name: "",
      code: "",
      adminName: "",
      adminEmployeeId: "",
      adminPassword: "",
    });
  const reset = () => {
    setShow(false);
    setEdit(null);
    setError("");
    setWithAdmin(true);
    setForm({
      name: "",
      code: "",
      adminName: "",
      adminEmployeeId: "",
      adminPassword: "",
    });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const body = edit
        ? { id: edit.id, name: form.name, code: form.code }
        : {
            name: form.name,
            code: form.code,
            ...(withAdmin
              ? {
                  adminName: form.adminName,
                  adminEmployeeId: form.adminEmployeeId,
                  adminPassword: form.adminPassword,
                }
              : {}),
          };
      await json("/api/plants", {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      reset();
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const toggle = async (p: Plant) => {
    try {
      await json("/api/plants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, active: !p.active }),
      });
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  if (currentUser.role !== "Super Admin")
    return (
      <div className="page">
        <Title title="Plants" subtitle="Corporate plant management" />
        <div className="empty">Only Super Admin can manage plants.</div>
      </div>
    );
  return (
    <div className="page">
      <div className="dashboard-heading">
        <Title
          title="Plants"
          subtitle="Create a plant and its first Plant Admin in one onboarding step"
        />
        <button
          className="primary-btn compact"
          onClick={() => {
            setEdit(null);
            setWithAdmin(true);
            setForm({
              name: "",
              code: "",
              adminName: "",
              adminEmployeeId: "",
              adminPassword: "",
            });
            setShow(true);
          }}
        >
          <Plus size={17} /> ADD PLANT
        </button>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Plant Database</h3>
          <span>
            {plants.filter((p) => p.active).length} active • {plants.length}{" "}
            total
          </span>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="department-list">
          {plants.map((p) => {
            const m = corporatePlants.find((x: any) => x.id === p.id);
            return (
              <div className="department-row" key={p.id}>
                <div className="department-main">
                  <b data-no-translate>{p.name}</b>
                  <small>
                    {p.code}
                    {m
                      ? ` • ${m.employees} employees • ${m.reportedYtd} ESO YTD`
                      : ""}
                  </small>
                </div>
                <Badge text={p.active ? "Active" : "Inactive"} />
                <div className="department-actions">
                  <button
                    className="outline-small"
                    onClick={() => {
                      setEdit(p);
                      setForm({
                        name: p.name,
                        code: p.code,
                        adminName: "",
                        adminEmployeeId: "",
                        adminPassword: "",
                      });
                      setShow(false);
                    }}
                  >
                    <ActionPencil
                      size={16}
                      aria-hidden="true"
                      className="action-icon"
                    />
                    EDIT
                  </button>
                  <button className="outline-small" onClick={() => toggle(p)}>
                    <ActionPower
                      size={16}
                      aria-hidden="true"
                      className="action-icon"
                    />
                    {p.active ? "DEACTIVATE" : "ACTIVATE"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {(show || edit) && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={submit}>
            <h3>{edit ? "Edit Plant" : "Add Plant"}</h3>
            <p>
              {edit
                ? "Update the plant identity."
                : "The new plant is isolated from other plants. You can also create its first Plant Admin now."}
            </p>
            <label>
              Plant Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Madrid"
              />
            </label>
            <label>
              Plant Code
              <input
                required
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g. MADRID"
              />
            </label>
            {!edit && (
              <>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={withAdmin}
                    onChange={(e) => setWithAdmin(e.target.checked)}
                  />
                  <span>Create first Plant Admin now</span>
                </label>
                {withAdmin && (
                  <>
                    <div className="owner-section-title">First Plant Admin</div>
                    <label>
                      Full Name
                      <input
                        required
                        value={form.adminName}
                        onChange={(e) =>
                          setForm({ ...form, adminName: e.target.value })
                        }
                        placeholder="e.g. Carlos Ruiz"
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Employee ID
                        <input
                          required
                          value={form.adminEmployeeId}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              adminEmployeeId: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Temporary Password
                        <input
                          required
                          minLength={8}
                          type="password"
                          value={form.adminPassword}
                          onChange={(e) =>
                            setForm({ ...form, adminPassword: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <p className="modal-note">
                      This Admin is automatically locked to{" "}
                      {form.name || "the new plant"}. Employees, departments and
                      locations created by this Admin will inherit the same
                      plant.
                    </p>
                  </>
                )}
              </>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="outline-btn" onClick={reset}>
                <ActionX size={16} aria-hidden="true" className="action-icon" />
                Cancel
              </button>
              <button className="primary-btn">
                <ActionSave
                  size={16}
                  aria-hidden="true"
                  className="action-icon"
                />
                {edit ? "Save Changes" : "Create Plant"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


