import { expect, test } from "bun:test"
import { type MemberDisplayFields, printMembers } from "../../src/utils/member-display.ts"
import { captureOutput } from "./snapshot_with_fake_time.ts"

function member(overrides: Partial<MemberDisplayFields> = {}): MemberDisplayFields {
  return {
    name: "Ada Lovelace",
    displayName: "ada",
    email: "ada@example.com",
    active: true,
    initials: "AL",
    guest: false,
    isAssignable: true,
    admin: false,
    owner: false,
    isMe: false,
    ...overrides,
  }
}

async function render(m: MemberDisplayFields): Promise<string> {
  const { stdout } = await captureOutput(() => {
    printMembers([m], "Members")
  })
  return stdout
}

test("printMembers - renders no markers for a plain active member", async () => {
  expect(await render(member())).toContain("ada (Ada Lovelace) [AL]\n")
})

test("printMembers - renders every marker in a fixed order", async () => {
  const output = await render(
    member({
      active: false,
      guest: true,
      isAssignable: false,
      admin: true,
      owner: true,
      isMe: true,
    }),
  )

  expect(output).toContain(
    "ada (Ada Lovelace) [AL] (inactive) (guest) (not assignable) (admin) (owner) (you)",
  )
})

test("printMembers - admin and owner are independent markers", async () => {
  expect(await render(member({ admin: true }))).toContain("[AL] (admin)\n")
  expect(await render(member({ owner: true }))).toContain("[AL] (owner)\n")
})

test("printMembers - omits the parenthesised full name when it matches displayName", async () => {
  const output = await render(member({ name: "Carol Carol", displayName: "Carol Carol" }))
  expect(output).toContain("Carol Carol [AL]")
  expect(output).not.toContain("Carol Carol (Carol Carol)")
})

test("printMembers - skips a lastSeen that is not a usable date", async () => {
  // Linear's DateTime scalar is `any` in codegen, so guard the value rather
  // than printing "Invalid Date".
  expect(await render(member({ lastSeen: null }))).not.toContain("Last seen:")
  expect(await render(member({ lastSeen: "not a date" }))).not.toContain("Last seen:")
})

test("printMembers - formats a usable lastSeen", async () => {
  const output = await render(member({ lastSeen: new Date("2026-03-04T05:06:07Z") }))
  expect(output).toContain("Last seen:")
})
