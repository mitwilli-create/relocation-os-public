# How It Fails

An honest threat model beats a feature list. This system is an agent with tools, memory, and
the ability to act, which means it has real attack surface and real failure modes. This
document names the ones that matter, what the architecture does about each, and where the
defense is partial. Nothing here is theoretical hand-waving: three of the four are drawn from
live incidents, two of them hit this build directly.

## 1. Prompt injection

The surface. An agent that reads untrusted text (a web page, a research result, a pasted
brief, a file it was told to summarize) can have that text act as instructions. A poisoned
source can try to exfiltrate context, rewrite a plan, or talk the agent past a locked
decision. For a system whose entire job is research over external content, this is the primary
surface, not an edge case.

What this system does about it.
- Locked decisions are enforced by code, not by the agent's judgment. `constraint-gate`
  validates a plan against the registry deterministically. Injected text cannot talk a script
  out of a `CONFLICT`; the exit code is not persuadable.
- Retrieval is read-only and scoped. The `relocation-kb` server cannot write, so an injection
  that reaches it still cannot mutate memory or escape the served directory.
- The privacy boundary is structural. Even a fully hijacked agent cannot publish
  `memory/private/`, because the public cut copies only tracked files and re-scans the result
  with the full marker list (see section 2's cousin defense and ADR-0007).

Where it is partial. Nothing here prevents a hijacked agent from producing a bad
recommendation inside its allowed scope. The defense limits blast radius (no writes, no
private exfiltration, no crossing a locked gate); it does not guarantee good judgment on
attacker-influenced input. A human still reviews booking-adjacent output.

## 2. The stdio RCE class (CVE-2026-30623)

The class. In April 2026, OX Security disclosed a command-injection flaw in the Model Context
Protocol SDK's stdio transport: `StdioServerParameters` executes whatever command string it is
handed. CVE-2026-30623 is the LiteLLM instance of it, an authenticated remote code execution
where a user who could add an MCP server supplied arbitrary `command` and `args` that ran as a
subprocess on the host. The design pattern rippled across the official SDKs (Python,
TypeScript, Java, Rust), a supply chain measured in the hundreds of thousands of server
instances. The upstream fix was an allowlist of known launchers.

Attribution. These CVE-2026-30623 facts are web-sourced, not council-adjudicated. Source: the
April 2026 OX Security disclosure, reported by the
[LiteLLM advisory](https://docs.litellm.ai/blog/mcp-stdio-command-injection-april-2026),
[The Hacker News](https://thehackernews.com/2026/04/anthropic-mcp-design-vulnerability.html),
and [VentureBeat](https://venturebeat.com/security/mcp-stdio-flaw-200000-ai-agent-servers-exposed-ox-security-audit).
Verification tier: web-corroborated across three independent public advisories, confirmed on
2026-07-09. This is a lower tier than the council-adjudicated claims that graduate into
`memory/` and the KB; it is a public-record CVE, cited here for the threat model, not a claim
entering the system's memory.

Why it bites an agentic OS. MCP servers run with ambient host privilege. A malicious or
compromised server, or a host that executes untrusted server config, is code execution on the
machine. The blast radius is the whole home directory unless something narrows it.

What this system does about it. The `relocation-kb` server (ADR-0005) is built as least
privilege by construction, which is the containment posture this CVE class demands:
- One vetted, first-party server. The system does not execute arbitrary third-party MCP server
  configs; the servers it runs are its own, checked into the repo.
- Read-only tools. Every tool is annotated read-only and the server has no write path, so a
  server-side compromise cannot alter the repo or memory.
- Directory scoping with a canonicalize-then-verify path gate. The server resolves symlinks
  and canonicalizes a requested path, then verifies it is inside the served scope before
  reading. `memory/private/` and anything outside the scope are denied by construction, never
  by a string prefix check that a `..` or a symlink could defeat. A regression test
  (`test/symlink-test.ts`) pins the symlink-traversal case that a naive scope check would leak.

Where it is partial. Scoping contains what a compromised server can reach; it does not make the
transport itself safe. The honest posture is defense in depth: run few servers, run your own,
keep them read-only, and scope them tightly, so that the day an SDK ships a stdio bug the reach
is a single read-only directory rather than the home folder.

## 3. Context bloat and the token-inflation bug

The failure. Long agent sessions cost more than they appear to. A verified token-inflation bug
means context accumulates faster than the visible transcript suggests, so a session that feels
mid-length is already expensive and is also getting less sharp as relevant signal is diluted
by accumulated noise.

What this system does about it.
- Tiered memory. `MEMORY.md` is a small always-loaded index; Tier 2 files load only on topic
  match; the private corpus loads only when personalizing. The default read is deliberately
  small.
- Retrieval over dumping. The MCP server returns specific claims instead of whole files, so a
  question costs a query, not a corpus.
- Operational discipline in the contract. Prefer short sessions, compact early, and reserve
  expensive multi-agent councils for genuinely high-stakes questions, because a multi-agent
  run costs an order of magnitude more tokens than a single agent.

Where it is partial. These reduce the slope; they do not repeal it. A long enough session
still degrades. The mitigation is a habit (checkpoint and hand off before drift), not a
guarantee, so the build plan bakes in explicit handoff points rather than pretending sessions
can run indefinitely.

## 4. The interactive-hang failure (lived, 2026-07-08)

What happened. A background subagent was given a task that reached an approval prompt. Nothing
answered it, because a background subagent has no interactive channel, so it hung silently.
The signal that looks like death (no output, quiet process) was actually a process waiting
forever for input that could never arrive.

What this system does about it. It is now a standing rule in the harness contract: any
background agent prompt bans interactive pauses (no approval questions, no clarification
prompts) and must carry a bounded-effort fallback so it terminates on its own. The canonical
liveness signal for a background agent is the harness completion notification, never the
absence of output, file size, or process-list presence, because absence of signal is not
presence of failure.

Where it is partial. This is a discipline encoded in instructions, so it holds only as well as
the instructions are followed. The mitigation that does not depend on discipline is the
completion-notification contract: trust the explicit signal, and treat silence as unknown
rather than done.

## The through-line

Three of these four defenses are structural (code, scope, read-only boundaries) and one is
disciplinary (session hygiene). The structural ones are the ones to trust under adversarial
pressure. Where a defense is only disciplinary, this document says so, because a threat model
that oversells itself is its own failure mode.

Source attribution for the CVE-2026-30623 material is inline in section 2.
