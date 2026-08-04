import { auth } from "@/modules/auth";
import { headers } from "next/headers";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new ApiError("Unauthorized", 401);
  }
  return session;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof Response) return error;
  console.error(error);
  return json(
    { error: error instanceof Error ? error.message : "Internal error" },
    500,
  );
}
