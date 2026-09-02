import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Auth test route works" });
}