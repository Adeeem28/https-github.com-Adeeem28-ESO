import { priorityReportPage } from "@/lib/report-priority";
import { NextResponse } from "next/server";
import { db, sessionUser, scopePlant, roleName } from "@/lib/server";
import { fetchByIds } from "@/lib/pagination";
import { exportDateRange } from "@/lib/fiscal-year";
import { mapReports } from "@/lib/report-mapping";
import { REPORT_SELECT } from "@/lib/report-select";

export async function GET(request: Request) {
  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1),
    size = 50;
  if (!Number.isSafeInteger(page) || page < 1 || page > 20001)
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  let dates;
  try {
    dates = exportDateRange(params.get("from"), params.get("to"));
  } catch {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const filters = {
    q: (params.get("q") || "").trim().slice(0, 200),
    status: params.get("status") || "All",
    urgency: params.get("urgency") || "All",
    category: params.get("category") || "All",
    department: (params.get("department") || "All").slice(0, 200),
    location: (params.get("location") || "All").slice(0, 200),
    mine: params.get("mine") === "true",
    stars: params.get("stars") === "true",
    ...dates,
  };
  try {
    const result = { data: await priorityReportPage(db, me.id, filters, (page - 1) * size, size) };
    const ids: string[] = result.data.ids;
    if (!ids.length)
      return NextResponse.json({
        reports: [],
        total: result.data.total,
        page,
        pageSize: size,
      });
    let q = scopePlant(
      db
        .from("eso_reports")
        .select(REPORT_SELECT)
        .eq("company_id", me.company_id)
        .eq("reclassified_to_voe", false)
        .in("id", ids),
      me,
    );
    if (me.role === "employee" || filters.mine) q = q.eq("reporter_id", me.id);
    const rows = await q;
    if (rows.error) throw rows.error;
    const peopleIds = (rows.data || [])
      .flatMap((r: any) => [
        r.reporter_id,
        r.starred_by,
        ...(r.eso_report_stars || []).map((s: any) => s.starred_by),
        ...(Array.isArray(r.maintenance_tasks)
          ? r.maintenance_tasks
          : [r.maintenance_tasks]
        ).flatMap((t: any) => [t?.assigned_to, t?.completed_by]),
      ])
      .filter(Boolean);
    const people = await fetchByIds(peopleIds, (ids) =>
      db
        .from("employees")
        .select(
          "id,employee_no,first_name,last_name,role,annual_eso_target,active,departments(name)",
        )
        .eq("company_id", me.company_id)
        .in("id", ids)
        .order("id"),
    );
    if (people.error) throw people.error;
    const users = (people.data || []).map((u: any) => ({
      id: u.id,
      employeeId: u.employee_no,
      name: `${u.first_name} ${u.last_name}`.trim(),
      role: roleName(u.role),
      department: u.departments?.name || "Unassigned",
      annualTarget: u.annual_eso_target,
      active: u.active,
    }));
    const byId = new Map(
      mapReports(rows.data || [], users, me.id).map((r) => [r.id, r]),
    );
    return NextResponse.json({
      reports: ids.map((id) => byId.get(id)).filter(Boolean),
      total: result.data.total,
      page,
      pageSize: size,
    });
  } catch (error) {
    console.error("Report page unavailable", error);
    return NextResponse.json(
      { error: "Could not load reports. Please retry." },
      { status: 503 },
    );
  }
}

