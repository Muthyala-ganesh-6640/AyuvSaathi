import { describe, expect, it } from "vitest";

function authorize(ownerId: string, userId: string) {
  if (ownerId !== userId) {
    return { ok: false as const, status: 404 };
  }
  return { ok: true as const };
}

describe("record ownership", () => {
  it("denies access when the user id does not match the owner", () => {
    expect(authorize("user-a", "user-b")).toEqual({ ok: false, status: 404 });
  });

  it("allows access for the owner", () => {
    expect(authorize("user-a", "user-a")).toEqual({ ok: true });
  });
});
