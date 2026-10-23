import { NextResponse } from "next/server";
import {
  passwordSetupRequired,
  finishPasswordSetup,
  setSession,
} from "@/lib/server";
export async function GET() {
  return NextResponse.json({ required: await passwordSetupRequired() });
}
export async function POST(req: Request) {
  if (!(await passwordSetupRequired()))
    return NextResponse.json(
      { error: "Setup session expired. Please sign in again." },
      { status: 401 },
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    typeof body.newPassword !== "string" ||
    body.newPassword !== body.confirmPassword ||
    body.newPassword.length < 12 ||
    Buffer.byteLength(body.newPassword) > 72
  )
    return NextResponse.json(
      {
        error:
          "Passwords must match and contain at least 12 characters (maximum 72 bytes).",
      },
      { status: 400 },
    );
  const { data, error } = await finishPasswordSetup(body.newPassword);
  if (error || !data)
    return NextResponse.json(
      {
        error:
          "Could not save password. Use a new password different from your Employee ID, or sign in again if your session expired.",
      },
      { status: 400 },
    );
  await setSession(data);
  return NextResponse.json({ ok: true });
}
