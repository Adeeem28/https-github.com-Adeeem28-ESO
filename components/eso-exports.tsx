"use client";
import { useState } from "react";
import { Database, Download, FileSpreadsheet, FileText } from "lucide-react";
import type { ClosureRates, Department } from "@/types";
import { Title } from "./eso-shared";
import { ClosureRateMini } from "./eso-dashboard";

export function Exports({
  departments,
  closureRates,
}: {
  departments: Department[];
  closureRates?: ClosureRates;
}) {
  const [status, setStatus] = useState("All"),
    [urgency, setUrgency] = useState("All"),
    [department, setDepartment] = useState("All"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const href = (format: string) => {
    const q = new URLSearchParams({ format, status, urgency, department });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return `/api/export?${q.toString()}`;
  };
  return (
    <div className="page exports-page">
      <Title
        title="Data & Reports"
        subtitle="Export ESO data for management reports, Excel analysis, Power BI and other systems"
      />
      {closureRates && <ClosureRateMini rates={closureRates} />}
      <div className="panel export-panel">
        <div className="panel-head">
          <h3>Filter Export Data</h3>
          <span>Filters apply to all formats</span>
        </div>
        <div className="export-filters">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </label>
          <label>
            Urgency
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </label>
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="All">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name} data-no-translate>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="export-grid">
        <div className="export-card">
          <FileSpreadsheet size={30} />
          <h3>Excel Management Report</h3>
          <p>
            Includes ESO Data, Summary, Department Summary and Employee
            Performance sheets.
          </p>
          <a className="primary-btn" href={href("xlsx")}>
            <Download size={17} /> DOWNLOAD .XLSX
          </a>
        </div>
        <div className="export-card">
          <FileText size={30} />
          <h3>Raw CSV Data</h3>
          <p>
            Clean flat data for Power BI, Tableau, databases and further
            analysis.
          </p>
          <a className="outline-btn" href={href("csv")}>
            <Download size={17} /> DOWNLOAD .CSV
          </a>
        </div>
        <div className="export-card">
          <Database size={30} />
          <h3>Raw JSON Data</h3>
          <p>
            Structured export for integrations, scripts, APIs and technical
            processing.
          </p>
          <a className="outline-btn" href={href("json")}>
            <Download size={17} /> DOWNLOAD .JSON
          </a>
        </div>
      </div>
    </div>
  );
}
