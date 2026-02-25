export const runtime = "nodejs";

async function notFoundHandler() {
  return Response.json({ error: "Not Found" }, { status: 404 });
}

export const GET = notFoundHandler;
export const POST = notFoundHandler;
