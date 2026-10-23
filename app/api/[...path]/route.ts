import { env } from "cloudflare:workers";
import { handleApi, handleWebhook } from "@/lib/server/api";
export const dynamic = "force-dynamic";
const route = (request: Request) =>
  new URL(request.url).pathname === "/api/stripe/webhook"
    ? handleWebhook(request, env)
    : handleApi(request, env);
export function GET(request: Request) {
  return route(request);
}
export function POST(request: Request) {
  return route(request);
}
export function PUT(request: Request) {
  return route(request);
}
export function PATCH(request: Request) {
  return route(request);
}
export function DELETE(request: Request) {
  return route(request);
}
