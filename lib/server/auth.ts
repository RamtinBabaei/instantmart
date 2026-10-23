import { catalog } from "../catalog";
import { cookies, hash, HttpError, setCookie } from "./security";
import { publicUser, type UserRow } from "./repository";
import type { Role } from "../types";

export async function ensureCatalog(db: D1Database, scope: string) {
  const found = await db
    .prepare("SELECT id FROM workspaces WHERE id=?")
    .bind(scope)
    .first();
  if (found) return;
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO workspaces(id,created_at) VALUES (?,?)")
      .bind(scope, Date.now()),
    ...catalog.map((p) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO products(workspace_id,id,name,description,category,image,price,original_price,unit,stock,organic,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)",
        )
        .bind(
          scope,
          p.id,
          p.name,
          p.description,
          p.category,
          p.image,
          p.price,
          p.originalPrice,
          p.unit,
          p.stock,
          +p.organic,
        ),
    ),
  ]);
}
export async function currentUser(
  db: D1Database,
  request: Request,
): Promise<UserRow | null> {
  const token = cookies(request).im_session;
  if (!token) return null;
  return db
    .prepare(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1",
    )
    .bind(await hash(token), Date.now())
    .first<UserRow>();
}
export function requireRole(u: UserRow | null, ...roles: Role[]): UserRow {
  if (!u) throw new HttpError(401, "Please sign in to continue.");
  if (!roles.includes(u.role))
    throw new HttpError(403, "You do not have permission to do that.");
  return u;
}
export async function issueSession(
  db: D1Database,
  request: Request,
  u: UserRow,
  headers: Headers,
) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const old = cookies(request).im_session;
  await db.batch([
    ...(old
      ? [db.prepare("DELETE FROM sessions WHERE token=?").bind(await hash(old))]
      : []),
    db
      .prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES (?,?,?)")
      .bind(await hash(token), u.id, Date.now() + 604800000),
    db.prepare("DELETE FROM sessions WHERE expires_at<?").bind(Date.now()),
  ]);
  headers.append("Set-Cookie", setCookie("im_session", token, request));
  return publicUser(u);
}
export async function demoUser(
  db: D1Database,
  request: Request,
  role: Role,
  headers: Headers,
) {
  let scope = cookies(request).im_demo;
  if (!scope || !/^demo-[0-9a-f-]{36}$/.test(scope))
    scope = "demo-" + crypto.randomUUID();
  await ensureCatalog(db, scope);
  const id = `${scope}-${role}`;
  const names = {
    customer: "Alex Morgan",
    admin: "Store manager",
    delivery: "Jamie Rivera",
  };
  await db.batch(
    (["customer", "admin", "delivery"] as const).map((r) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO users(id,workspace_id,name,email,role,demo,phone,created_at) VALUES (?,?,?,?,?,1,?,?)",
        )
        .bind(
          `${scope}-${r}`,
          scope,
          names[r],
          `${r}@instantmart.demo`,
          r,
          "+1 503 555 0148",
          Date.now(),
        ),
    ),
  );
  const user = await db
    .prepare("SELECT * FROM users WHERE id=?")
    .bind(id)
    .first<UserRow>();
  if (!user) throw new HttpError(500, "Could not start the demo.");
  if (!user.active)
    throw new HttpError(
      403,
      "This demo partner is inactive. Activate them in the store management dashboard first.",
    );
  headers.append("Set-Cookie", setCookie("im_demo", scope, request));
  return issueSession(db, request, user, headers);
}
