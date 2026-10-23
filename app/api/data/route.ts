import { dashboardSummary } from "@/lib/dashboard-summary";
import { REPORT_SELECT } from "@/lib/report-select";
import { mapReports } from "@/lib/report-mapping";
import { NextResponse } from "next/server";
import {
  db,
  sessionUser,
  roleName,
  canAdmin,
  canMaintain,
  canViewAll,
  scopePlant,
  isSuperAdmin,
} from "@/lib/server";
import { fetchAll } from "@/lib/pagination";
export async function GET() {
  const me: any = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plantQuery = isSuperAdmin(me.role)
    ? db
        .from("plants")
        .select("id,name,code,active")
        .eq("company_id", me.company_id)
        .order("name")
    : db
        .from("plants")
        .select("id,name,code,active")
        .eq("company_id", me.company_id)
        .eq("id", me.plant_id)
        .order("name");
  let depQ: any = db
    .from("departments")
    .select("id,name,code,active,plant_id")
    .eq("company_id", me.company_id);
  depQ = scopePlant(depQ, me);
  let locQ: any = db
    .from("locations")
    .select(
      "id,name,active,department_id,plant_id,departments(name),plants(name,code)",
    )
    .eq("company_id", me.company_id);
  locQ = scopePlant(locQ, me);
  let empQ: any = db
    .from("employees")
    .select(
      "id,employee_no,first_name,last_name,role,annual_eso_target,active,department_id,plant_id,departments(name),plants(name,code)",
    )
    .eq("company_id", me.company_id);
  empQ = scopePlant(empQ, me);
  // Independent, tenant-scoped reads run together instead of three serial waves.
  const [
    plantResult,
    depResult,
    locResult,
    empResult,
    metricsResult,
    reportResult,
  ] = await Promise.all([
    fetchAll(plantQuery.order("id")),
    fetchAll(depQ.order("name").order("id")),
    fetchAll(locQ.order("name").order("id")),
    fetchAll(empQ.order("last_name").order("id")),
    db.rpc("eso_metrics_v628", { p_actor: me.id }),
        Promise.all(["critical", "high", "medium", "low"].map(urgency => {
      let query = scopePlant(db.from("eso_reports").select(REPORT_SELECT).eq("company_id", me.company_id).eq("reclassified_to_voe", false).eq("urgency", urgency), me);
      if (me.role === "employee") query = query.eq("reporter_id", me.id);
      return query.order("reported_at", {ascending:false}).order("id").limit(10);
    })).then(results => ({error:results.find(r=>r.error)?.error, data:results.flatMap(r=>r.data || []).slice(0,10)})),
  ]);
  if (
    [
      plantResult,
      depResult,
      locResult,
      empResult,
      metricsResult,
      reportResult,
    ].some((r) => r.error)
  )
    return NextResponse.json(
      { error: "Could not load company data. Please retry." },
      { status: 503 },
    );
  const plants = plantResult.data,
    deps = depResult.data,
    locs = locResult.data,
    emps = empResult.data,
    metrics = metricsResult.data,
    reports = reportResult.data;
  let dashboard;
  try {
    dashboard = await dashboardSummary(
      me,
      isSuperAdmin(me.role) ? plants || [] : [],
    );
  } catch {
    return NextResponse.json(
      { error: "Could not load dashboard counts. Please retry." },
      { status: 503 },
    );
  }
  const users = (emps || []).map((e: any) => ({
    id: e.id,
    employeeId: e.employee_no,
    name: `${e.first_name} ${e.last_name}`.trim(),
    department: e.departments?.name || "Unassigned",
    role: roleName(e.role),
    annualTarget: e.annual_eso_target,
    active: e.active,
    plantId: e.plant_id,
    plantName: e.plants?.name || "",
    plantCode: e.plants?.code || "",
  }));
  const userById = new Map(users.map((u: any) => [u.id, u]));
  const mapped = mapReports(reports || [], users, me.id);
  const leaderCounts = new Map<string, number>(
    (metrics.reporters || []).map((r: any) => [r.id, r.ytd]),
  );
  const globalTop =
    users
      .filter((u) => u.active)
      .map((u) => ({
        id: u.id,
        name: u.name,
        employeeId: u.employeeId,
        count: leaderCounts.get(u.id) || 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0] ||
    null;
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthly = metrics.monthly.map((r: any) => ({
    ...r,
    label: labels[r.month - 1],
  }));
  const decorate = (r: any) => {
    const u = userById.get(r.id);
    return {
      id: r.id,
      name: u?.name || "Unknown user",
      employeeId: u?.employeeId || "",
      department: u?.department || "—",
      role: u?.role || "—",
    };
  };
  const reporterLeaderboard = metrics.reporters
    .map((r: any) => ({
      ...decorate(r),
      reportedYtd: r.ytd,
      reportedThisMonth: r.month,
    }))
    .sort(
      (a: any, b: any) =>
        b.reportedYtd - a.reportedYtd ||
        b.reportedThisMonth - a.reportedThisMonth ||
        a.name.localeCompare(b.name),
    );
  const resolverLeaderboard = metrics.resolvers
    .map((r: any) => ({
      ...decorate(r),
      resolvedYtd: r.ytd,
      resolvedThisMonth: r.month,
    }))
    .sort(
      (a: any, b: any) =>
        b.resolvedYtd - a.resolvedYtd ||
        b.resolvedThisMonth - a.resolvedThisMonth ||
        a.name.localeCompare(b.name),
    );
  const closureRates = metrics.closureRates;
  const employeeCounts = new Map<string, number>();

  for (const user of users)
    if (user.active && user.plantId)
      employeeCounts.set(
        user.plantId,
        (employeeCounts.get(user.plantId) || 0) + 1,
      );
  const plantMetrics = new Map<
    string,
    { reportedYtd: number; resolvedYtd: number; open: number }
  >(metrics.plants.map((r: { id: string }) => [r.id, r]));
  const corporatePlants = isSuperAdmin(me.role)
    ? (plants || []).map((p: any) => {
        const counts = plantMetrics.get(p.id);
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          active: p.active,
          employees: employeeCounts.get(p.id) || 0,
          reportedYtd: counts?.reportedYtd || 0,
          resolvedYtd: counts?.resolvedYtd || 0,
          open: counts?.open || 0,
          overdue: dashboard.plantOverdue[p.id] || 0,
        };
      })
    : [];
  const current = users.find((u: any) => u.id === me.id),
    privilegedUsers =
      canAdmin(me.role) || canMaintain(me.role) || canViewAll(me.role);
  return NextResponse.json({
    currentUser: {
      ...current,
      companyId: me.company_id,
      companyName: me.companies?.name || "",
      companyCode: me.companies?.code || "",
      plantId: me.plant_id,
      plantName: me.plants?.name || "",
      plantCode: me.plants?.code || "",
    },
    users: privilegedUsers ? users : [current],
    reports: mapped,
    dashboard,
    topEmployeeYtd: globalTop,
    tracking: {
      year: metrics.year,
      currentMonth: metrics.currentMonth,
      monthly,
      reporterLeaderboard,
      resolverLeaderboard,
      closureRates,
    },
    plants: (plants || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      active: p.active,
    })),
    corporatePlants,
    departments: (deps || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code || null,
      active: d.active,
      plantId: d.plant_id,
    })),
    locations: (locs || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      active: l.active,
      departmentId: l.department_id,
      departmentName: l.departments?.name || null,
      plantId: l.plant_id,
      plantName: l.plants?.name || null,
    })),
  });
}


