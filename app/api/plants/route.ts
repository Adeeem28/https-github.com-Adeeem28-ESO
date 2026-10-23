import { NextResponse } from "next/server";
import { db, sessionUser, isSuperAdmin } from "@/lib/server";
function cleanCode(v: unknown) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me || !isSuperAdmin(me.role))
    return NextResponse.json(
      { error: "Only Super Admin can manage plants." },
      { status: 403 },
    );
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const name = String(b.name || "").trim(),
    code = cleanCode(b.code);
  if (!name || name.length > 120 || !code || code.length > 60)
    return NextResponse.json(
      { error: "Valid plant name and code are required." },
      { status: 400 },
    );
  const { data: plant, error } = await db.rpc("eso_create_plant_v626", {
    p_actor: me.id,
    p_data: {
      name,
      code,
      adminEmployeeId: String(b.adminEmployeeId || "").trim(),
      adminName: String(b.adminName || "").trim(),
      adminPassword: String(b.adminPassword || ""),
    },
  });
  if (error)
    return NextResponse.json(
      {
        error:
          "Could not create plant. Check its code and administrator details.",
      },
      { status: 400 },
    );
  return NextResponse.json({ ok: true, plant });
}
export async function PATCH(req: Request) {
  const me: any = await sessionUser();
  if (!me || !isSuperAdmin(me.role))
    return NextResponse.json(
      { error: "Only Super Admin can manage plants." },
      { status: 403 },
    );
  const b = await req.json(),
    updates: any = {};
  if (b.name !== undefined) updates.name = String(b.name || "").trim();
  if (b.code !== undefined) updates.code = cleanCode(b.code);
  if (b.active !== undefined) updates.active = !!b.active;
  const { error } = await db
    .from("plants")
    .update(updates)
    .eq("company_id", me.company_id)
    .eq("id", b.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
