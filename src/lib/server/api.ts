import "server-only";
import { connection, NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getDb, type DB } from "@/db";
import { getCurrentUser, type Role, type SessionUser } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const notFound = (what = "Record") => new ApiError(404, `${what} not found`);

type Ctx<P> = { req: NextRequest; user: SessionUser; db: DB; params: P };
type Options = { roles?: Role[]; public?: boolean };

/**
 * Wraps a route handler with authentication, role checks and uniform error
 * responses. Handlers return plain data, which is serialized as JSON.
 */
export function route<P = Record<string, string>>(
  fn: (ctx: Ctx<P>) => Promise<unknown>,
  options: Options = {},
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    // API routes always run at request time (never prerendered at build).
    // Must stay outside try/catch so Next.js can abort prerendering.
    await connection();
    try {
      const db = await getDb();
      const user = await getCurrentUser();
      if (!options.public) {
        if (!user) throw new ApiError(401, "Please sign in to continue");
        if (options.roles && !options.roles.includes(user.role)) {
          throw new ApiError(403, "You do not have permission to do this");
        }
      }
      const params = (context?.params ? await context.params : {}) as P;
      const result = await fn({ req, user: user as SessionUser, db, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.join(".");
    return NextResponse.json(
      { error: field ? `${field}: ${first.message}` : (first?.message ?? "Invalid input") },
      { status: 400 },
    );
  }
  const pgCode = (err as { code?: string; cause?: { code?: string } })?.code ??
    (err as { cause?: { code?: string } })?.cause?.code;
  if (pgCode === "23505") {
    return NextResponse.json({ error: "A record with the same unique value already exists" }, { status: 409 });
  }
  if (pgCode === "23503") {
    return NextResponse.json(
      { error: "This record is used elsewhere and cannot be removed. Deactivate it instead." },
      { status: 409 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
  return schema.parse(data);
}

export function idParam(value: string | undefined) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  return id;
}

export function searchParam(req: NextRequest, key: string) {
  return req.nextUrl.searchParams.get(key)?.trim() || "";
}

export function roundMoney(n: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
