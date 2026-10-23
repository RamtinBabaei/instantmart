import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function passwordHash(
  password: string,
  salt = crypto.randomUUID(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `${salt}:${Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}
export function constantEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a),
    bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++)
    diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
export async function verifyPassword(password: string, stored: string) {
  return constantEqual(
    await passwordHash(password, stored.split(":")[0]),
    stored,
  );
}
export function cookies(request: Request): Record<string, string> {
  const entries: [string, string][] = [];
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const split = part.indexOf("=");
    if (split < 0) continue;
    try {
      entries.push([
        decodeURIComponent(part.slice(0, split).trim()),
        decodeURIComponent(part.slice(split + 1)),
      ]);
    } catch {
      /* Ignore malformed, unrelated cookies. */
    }
  }
  return Object.fromEntries(entries);
}
export function setCookie(
  name: string,
  value: string,
  request: Request,
  maxAge = 604800,
) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "This request is not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use application/json.");
}
export async function body<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  if (Number(request.headers.get("content-length")) > 32768)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new HttpError(
      422,
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return parsed.data;
}
export async function rateLimit(
  db: D1Database,
  request: Request,
  action: string,
  limit = 30,
) {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const key = await hash(`${action}:${ip}:${Math.floor(Date.now() / 60000)}`);
  const row = await db
    .prepare(
      "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(key, Date.now() + 60000)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > limit)
    throw new HttpError(
      429,
      "Too many attempts. Please try again in a minute.",
    );
  await db
    .prepare("DELETE FROM rate_limits WHERE expires_at < ?")
    .bind(Date.now())
    .run();
}
