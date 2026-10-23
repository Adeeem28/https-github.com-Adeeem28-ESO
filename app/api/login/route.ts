import { NextResponse } from "next/server";
import { db, setSession, loginAllowed } from "@/lib/server";
export async function POST(req: Request) {
  try {
    const b = await req.json(),
      employeeId = String(b.employeeId || "").trim(),
      company = String(b.companyCode || "").trim(),
      plant = String(b.plantCode || "").trim(),
      password = String(b.password || "");
    if (
      !employeeId ||
      !password ||
      employeeId.length > 100 ||
      company.length > 100 ||
      plant.length > 100 ||
      Buffer.byteLength(password) > 72
    )
      return NextResponse.json(
        { error: "Invalid login details." },
        { status: 400 },
      );
    if (!(await loginAllowed(req, `${company}:${plant}:${employeeId}`)))
      return NextResponse.json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const { data: u, error } = await db.rpc("eso_login_v626", {
      p_employee_no: employeeId,
      p_password: password,
      p_company_code: company || null,
      p_plant_code: plant || null,
    });
    if (error) throw new Error('Login database request failed.');
    if (!u)
      return NextResponse.json(
        { error: "Invalid Employee ID, company code or password." },
        { status: 401 },
      );
    await setSession(u.id, u.password_setup === true);
    return NextResponse.json({
      passwordSetupRequired: u.password_setup === true,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Login temporarily unavailable. Check the server configuration and database migration.",
      },
      { status: 503 },
    );
  }
}
