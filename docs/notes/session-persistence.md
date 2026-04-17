# Session Persistence (mobile)

## Goal

Today, refreshing the mobile PWA mid-session loses all captured records and in-memory images. The socket reconnects but `captureRecords` / `labelCount` are reset. For a real operator on a warehouse floor (flaky wifi, accidental tab swipe), this is a foot-gun.

## What to persist

- `appState`, `captureRecords` (image + extraction + error per record), `labelCount`.
- `sessionId` so the PWA can rejoin the same room on reconnect.

## Where

- `sessionStorage` for the session-scoped state — wiped on tab close which is probably the desired semantics (a "session" ends when the operator walks away).
- **Not** `localStorage` — we don't want captures from one shift bleeding into the next.
- Images are base64 strings up to ~200KB each. `sessionStorage` has a ~5MB budget on most browsers, so ~20–25 labels max before we need to start dropping the oldest thumbnails or moving to `IndexedDB`. Fine for demo scope.

## Implementation sketch

1. In `ReceiveContent`, add a `useEffect` that writes `captureRecords` + `labelCount` + `appState` + `sessionId` to `sessionStorage` under a single key on any change.
2. On mount, hydrate initial state from `sessionStorage` if present — taking priority over the URL `?session=` param (or merging if URL matches).
3. On Close, clear the sessionStorage entry.
4. Add a "Resume session" affordance if hydration finds state but the socket shows `idle` → the user is rejoining after reload.

## Non-goals

- Cross-device sync.
- Persisting the live extraction stream mid-flight (only persist after `extraction:complete` / `extraction:error`).
- Offline capture without relay connectivity. If the socket can't reach the relay, the capture is just lost. We're not building queue-and-forward yet.

## Related

Ties into [dutchie-autofill.md](./dutchie-autofill.md) only in that autofill needs the records to still exist when the user eventually gets to Dutchie. If the extension holds the records (it does), persistence may be redundant — the mobile side's role after Done is just the review screen. Decide based on whether users tend to close the mobile tab before getting to Dutchie.
