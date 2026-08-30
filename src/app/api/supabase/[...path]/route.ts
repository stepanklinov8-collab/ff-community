import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Params = Promise<{ path: string[] }>;

async function handleProxy(request: Request, params: Params, method: string) {
  const { path } = await params;
  const supabasePath = path.join("/") + new URL(request.url).search;
  const url = `${SUPABASE_URL}/${supabasePath}`;

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: request.headers.get("Authorization") || "",
  };

  const contentType = request.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;

  let body: BodyInit | null = null;
  if (method !== "GET" && method !== "HEAD" && request.body) {
    body = await request.arrayBuffer();
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    duplex: "half",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
}

export async function GET(request: Request, { params }: { params: Params }) {
  return handleProxy(request, params, "GET");
}

export async function POST(request: Request, { params }: { params: Params }) {
  return handleProxy(request, params, "POST");
}

export async function PUT(request: Request, { params }: { params: Params }) {
  return handleProxy(request, params, "PUT");
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  return handleProxy(request, params, "DELETE");
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  return handleProxy(request, params, "PATCH");
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}