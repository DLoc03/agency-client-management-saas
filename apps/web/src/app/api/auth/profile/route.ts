import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  return proxyToBackend(request, "auth/profile");
}