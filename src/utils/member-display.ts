/**
 * Shared human-readable renderer for Linear members.
 *
 * Used by `team members` and `user list` so both surfaces stay identical.
 */

// Structural shape shared by team members and workspace members. Both generated
// node types satisfy this, so the renderer stays decoupled from codegen symbols.
export interface MemberDisplayFields {
  name: string
  displayName: string
  email: string
  active: boolean
  initials: string
  description?: string | null
  timezone?: string | null
  // Linear's `DateTime` custom scalar. codegen has no scalar mapping, so the
  // generated node types expose it as `any` — take it as `unknown` here and
  // narrow at the point of formatting rather than trusting an untyped value.
  lastSeen?: unknown
  statusEmoji?: string | null
  statusLabel?: string | null
  guest: boolean
  isAssignable: boolean
  admin: boolean
  owner: boolean
  isMe: boolean
}

// admin and owner are independent in Linear's schema — an owner who is also an
// admin shows both markers.
function markersFor(member: MemberDisplayFields): string {
  const markers: string[] = []
  if (!member.active) markers.push("inactive")
  if (member.guest) markers.push("guest")
  if (!member.isAssignable) markers.push("not assignable")
  if (member.admin) markers.push("admin")
  if (member.owner) markers.push("owner")
  if (member.isMe) markers.push("you")

  return markers.map((marker) => ` (${marker})`).join("")
}

/** Narrow the `DateTime` scalar to something `new Date()` accepts, or skip it. */
function formatLastSeen(lastSeen: unknown): string | undefined {
  if (typeof lastSeen !== "string" && typeof lastSeen !== "number" && !(lastSeen instanceof Date)) {
    return undefined
  }
  const date = new Date(lastSeen)
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString()
}

export function printMembers(members: readonly MemberDisplayFields[], heading: string): void {
  console.log(`${heading} (${members.length}):`)
  console.log("")

  for (const member of members) {
    const displayName = member.displayName || member.name
    const fullName = member.name !== member.displayName ? ` (${member.name})` : ""

    console.log(`${displayName}${fullName} [${member.initials}]${markersFor(member)}`)
    if (member.email) {
      console.log(`  Email: ${member.email}`)
    }
    if (member.description) {
      console.log(`  Role: ${member.description}`)
    }
    if (member.timezone) {
      console.log(`  Timezone: ${member.timezone}`)
    }
    if (member.statusEmoji && member.statusLabel) {
      console.log(`  Status: ${member.statusEmoji} ${member.statusLabel}`)
    }
    const lastSeen = formatLastSeen(member.lastSeen)
    if (lastSeen) {
      console.log(`  Last seen: ${lastSeen}`)
    }
    console.log("")
  }
}
