import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "tags");
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "tags");
}
