import { NextResponse } from "next/server";
import { db, sessionUser, scopePlant, roleName } from "@/lib/server";
import { fetchAll } from "@/lib/pagination";
import { REPORT_SELECT } from "@/lib/report-select";
import { mapReports } from "@/lib/report-mapping";

// Legacy workspaces/drilldowns request their history explicitly; bootstrap never calls this.
export async function GET(request: Request) {
  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (
    id &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  let query = scopePlant(
    db
      .from("eso_reports")
      .select(REPORT_SELECT)
      .eq("company_id", me.company_id)
      .eq("reclassified_to_voe", false),
    me,
  );
  if (me.role === "employee") query = query.eq("reporter_id", me.id);
  if (id) query = query.eq("id", id);
  const [rows, people] = await Promise.all([
    fetchAll(query.order("reported_at", { ascending: false }).order("id")),
    fetchAll(
      scopePlant(
        db
          .from("employees")
          .select("id,first_name,last_name,role")
          .eq("company_id", me.company_id),
        me,
      ).order("id"),
    ),
  ]);
  if (rows.error || people.error)
    return NextResponse.json(
      { error: "Could not load report history. Please retry." },
      { status: 503 },
    );
  const users = (people.data || []).map((u) => ({
    id: u.id,
    name: [u.first_name, u.last_name].join(" ").trim(),
    role: roleName(u.role),
  }));
  return NextResponse.json(
    { reports: mapReports(rows.data || [], users, me.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
