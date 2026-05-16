import { NextResponse } from "next/server";

export async function POST() {
  // ESC/POS USB printing is not available in Node.js/Next.js environment
  // Use browser window.print() or a dedicated print service instead
  return NextResponse.json({
    success: false,
    error: "USB printing is not supported in Next.js. Use browser print (window.print()) instead.",
  }, { status: 501 });
}
