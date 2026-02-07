import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("Received Apple Health webhook", payload);
    // TODO: Validate signature and process the payload.
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error handling Apple Health webhook", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
