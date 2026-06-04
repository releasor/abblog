import { NextResponse, type NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
}

export function requireId(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0) throw new InvalidIdError();
  return id;
}

class InvalidIdError extends Error {
  constructor() {
    super("无效ID");
  }
}

export function invalidIdResponse() {
  return NextResponse.json({ error: "无效ID" }, { status: 400 });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}
