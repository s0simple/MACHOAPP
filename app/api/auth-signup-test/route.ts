import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    console.log("Request body:", body);
    console.log("Request URL:", req.url);
    
    const response = await auth.handler(req);
    const responseText = await response.text();
    console.log("Auth handler response status:", response.status);
    console.log("Auth handler response body:", responseText);
    
    return NextResponse.json({ 
      success: true, 
      authResponse: {
        status: response.status,
        body: responseText,
      }
    });
  } catch (error: any) {
    console.error("Auth handler error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}