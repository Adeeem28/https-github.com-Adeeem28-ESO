import { db, scopePlant } from "./server";
import { fiscalYearInfo } from "./fiscal-year";

// HEAD counts stay in PostgreSQL: no report history is transferred to Node.
export async function dashboardSummary(me: any, plants: Array<{ id: string }>) {
  const fy = fiscalYearInfo();
  const countQuery = (overdue = false) => {
    let q = scopePlant(
      db
        .from("eso_reports")
        .select(overdue ? "id,maintenance_tasks!inner(status,due_at)" : "id", {
          count: "exact",
          head: true,
        })
        .eq("company_id", me.company_id)
        .eq("reclassified_to_voe", false),
      me,
    );
    if (me.role === "employee") q = q.eq("reporter_id", me.id);
    return q;
  };
  const overdueQuery = () =>
    countQuery(true)
      .not("status", "in", "(completed,closed)")
      .not("maintenance_tasks.status", "eq", "completed")
      .lt("maintenance_tasks.due_at", new Date().toISOString());
  const yearQuery = (withTask = false) =>
    countQuery(withTask)
      .gte("reported_at", fy.start.toISOString())
      .lt("reported_at", fy.end.toISOString());
  const plantYearQuery = (withTask = false) =>
    me.plant_id
      ? yearQuery(withTask).eq("plant_id", me.plant_id)
      : yearQuery(withTask);
  const queries = [
    yearQuery(),
    countQuery().not(
      "status",
      "in",
      "(completed,closed,in_progress,assigned,waiting)",
    ),
    countQuery().in("status", ["in_progress", "assigned", "waiting"]),
    countQuery().in("status", ["completed", "closed"]),
    countQuery()
      .eq("urgency", "critical")
      .not("status", "in", "(completed,closed)"),
    overdueQuery(),
    plantYearQuery(),
    plantYearQuery().or(
      "status.in.(completed,closed),completed_at.not.is.null",
    ),
    // Keep the existing closure definition for legacy task-only completion dates.
    plantYearQuery(true)
      .not("status", "in", "(completed,closed)")
      .is("completed_at", null)
      .not("maintenance_tasks.completed_at", "is", null),
    ...plants.map((p) => overdueQuery().eq("plant_id", p.id)),
  ];
  const results = await Promise.all(queries);
  if (results.some((r) => r.error || r.count == null))
    throw new Error("Dashboard counts unavailable");
  const [
    ytd,
    open,
    inProgress,
    completed,
    critical,
    overdue,
    plantReported,
    plantClosed,
    legacyTaskClosed,
  ] = results.map((r) => r.count!);
  return {
    ytd,
    open,
    inProgress,
    completed,
    critical,
    overdue,
    plantReported,
    plantClosed: plantClosed + legacyTaskClosed,
    plantOverdue: Object.fromEntries(
      plants.map((p, i) => [p.id, results[i + 9].count!]),
    ),
  };
}
