import { NextResponse } from "next/server";

export function parseId(value: string): number | null {
  const id = parseInt(value);
  return isNaN(id) ? null : id;
}

export function requireId(value: string): number {
  const id = parseInt(value);
  if (isNaN(id)) throw new InvalidIdError();
  return id;
}

export class InvalidIdError extends Error {
  constructor() {
    super("无效ID");
  }
}

export function invalidIdResponse() {
  return NextResponse.json({ error: "无效ID" }, { status: 400 });
}
