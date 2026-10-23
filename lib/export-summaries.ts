type ReportRow = {
  Plant: string;
  "Plant Code": string;
  Department: string;
  "Employee ID": string;
  Employee: string;
  Status: string;
};
function summarize(rows: ReportRow[], fields: (keyof ReportRow)[]) {
  const groups = new Map<string, Record<string, string | number>>();
  for (const row of rows) {
    const key = JSON.stringify(fields.map((field) => row[field]));
    let summary = groups.get(key);
    if (!summary) {
      summary = {
        ...Object.fromEntries(fields.map((field) => [field, row[field]])),
        "ESO YTD": 0,
        Open: 0,
        "In Progress": 0,
        Completed: 0,
      };
      groups.set(key, summary);
    }
    summary["ESO YTD"] = Number(summary["ESO YTD"]) + 1;
    if (["Open", "In Progress", "Completed"].includes(row.Status))
      summary[row.Status] = Number(summary[row.Status]) + 1;
  }
  return [...groups.values()];
}
export function managementSummarySheets(rows: ReportRow[]) {
  return [
    {
      name: "Department Summary",
      rows: summarize(rows, ["Plant", "Plant Code", "Department"]),
    },
    {
      name: "Employee Performance",
      rows: summarize(rows, [
        "Plant",
        "Plant Code",
        "Employee ID",
        "Employee",
        "Department",
      ]),
    },
  ];
}
