# Project Notes

Living notes on work planned for future sprints. Each file captures the intent, constraints, and rough shape of a chunk of work so we can pick it up later without reconstructing context from scratch.

## Index

- [dutchie-autofill.md](./dutchie-autofill.md) — Extension autofills Dutchie's receiving form from extracted fields once the session completes (W5+).
- [extension-review-screen.md](./extension-review-screen.md) — Mirror the mobile completion view inside the extension popup so the desktop user can verify captures (optional; orthogonal to autofill).
- [session-persistence.md](./session-persistence.md) — Persist mobile session state (records + images) across reloads / tab closures.
- [label-specific-extraction.md](./label-specific-extraction.md) — Dedicated Claude Vision prompt for product labels instead of reusing the invoice prompt.

## Conventions

- One file per initiative. Keep it short — focused on **why** and **what's decided**, not a play-by-play.
- If a note describes work that is shipping this week, remove it from this folder and let the PR description carry the detail instead.
- When something from this folder ships, delete the note (or squash it into CLAUDE.md / README.md if it describes now-permanent behavior).
