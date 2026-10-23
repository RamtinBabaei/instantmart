import { afterEach, expect, it, vi } from "vitest";
import { createRequestId } from "../lib/client";
afterEach(() => vi.unstubAllGlobals());
it("generates UUIDs even in an HTTP preview without crypto.randomUUID", () => {
  const original = crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: original.getRandomValues.bind(original),
  });
  const ids = Array.from({ length: 20 }, () => createRequestId());
  expect(new Set(ids).size).toBe(20);
  for (const id of ids)
    expect(id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
});
