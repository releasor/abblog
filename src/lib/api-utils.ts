import { NextResponse } from "next/server";

export function requireId(value: string): number {
  const id = parseInt(value);
  if (isNaN(id)) throw new InvalidIdError();
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
