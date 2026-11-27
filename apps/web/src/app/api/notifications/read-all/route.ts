import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "notifications/read-all");
}
