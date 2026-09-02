import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { auth } = await import("@/lib/auth");
    return NextResponse.json({ 
      success: true, 
      hasHandler: typeof auth?.handler === "function",
      authKeys: Object.keys(auth || {}),
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}