# Trakie Timeline — Updated M3 & M4

Supersedes the M3 and M4 sections of `Trakie Timeline.pdf` following Dutchie's rejection of the Integration Partnership Program (April 7, 2026).

## What changed and why

The original M3 built a **mock** Dutchie receiving form and M4 replaced that mock with the **official GraphQL API**. With partner API access denied (see `memory/dutchie-integration.md`), there is no official API endgame to swap to. DOM autofill against the live Dutchie receiving page is now the primary — and only — integration path.

The work does not shrink, it shifts:

- **M3** still ships the demo and the Demo tab on trakie.ai, but instead of autofilling a mock form it autofills **real Dutchie** via a content script. The mock form is dropped.
- **M4** no longer integrates GraphQL. It hardens DOM autofill into something maintainable: resilient selectors, breakage detection, merge/dedup logic, and handoff docs.

The adapter-layer abstraction from the original M4W1 is retained — it still pays off if Dutchie reopens the partner program later ("their email leaves the door open"), and it keeps the content-script code clean in the meantime.

---

## Month 3 — Milestone 3: Demo Complete & Live on trakie.ai

### W1 — Dutchie Content Script & Field Mapping

- Add `content_scripts` + `host_permissions` to `extension/manifest.json` matching the Dutchie receiving page URL pattern (confirm pattern from Steven's reference recording)
- Build the content script: wait for form hydration via `MutationObserver` on the form container before writing
- Implement the handshake: `chrome.tabs.sendMessage` from `popup.ts` on `session:complete` → content script receives `{ type: "TRAKIE_AUTOFILL", records }`
- Build the field-mapping layer: `DutchieReceivingRecord` key → selector + input strategy (text input, combobox dropdown, date picker)
- Fire native `input` / `change` events after writes so React-controlled inputs accept the values
- Confidence surfacing: inject CSS so red fields render visually flagged in Dutchie (tooltip badge or background tint); green fields fill silently with a checkmark indicator
- Fallback CTA when no Dutchie tab is open: popup shows "Open Dutchie receiving to autofill" and caches the payload until a matching tab exists
- Match trakie.ai visual style on any injected UI surfaces (badges, banners)

### W2 — Performance Optimization & 15-Second Target

- Profile the full pipeline: capture → compress → relay → Claude API → stream → DOM autofill
- Optimize image compression settings (quality vs. file size tradeoff)
- Confirm with Steven: Sonnet (speed) vs. Opus (accuracy) for the extraction model
- Optimize prompt length; parallel field streaming so autofill begins as fields arrive, not after extraction completes
- Target: photo taken → Dutchie form fully populated in under 15 seconds on broadband, under 30 seconds on mobile data
- Stress test on slower connections — confirm graceful degradation
- Row handling: start with "one row per capture record" in Dutchie; iterate if Steven prefers label-into-invoice merge by `batchLotNumber`

### W3 — Demo Video & Demo Tab

- Prepare demo environment: clean desktop, real Dutchie receiving page open as the only visible surface (no dev tools, terminal, or localhost)
- Rehearse the full flow against live Dutchie multiple times
- Record raw 60-second video: extension opens → QR appears → phone scans → invoice photo → label photo → Dutchie form fills in real time → completion screen
- Use real-looking invoice and label images (provided by Steven), highest screen and camera resolution
- Review recording — reshoot if anything looks rough
- Build the Demo tab on trakie.ai: embed the edited video (after Steven's edit pass) or a live interactive demo
- Deploy Demo tab to production trakie.ai

### W4 — Full QA & Milestone Submission

- End-to-end regression: QR bridge, auto-capture, extraction, Dutchie autofill, confidence flags, vibrations, auto-step, completion screen
- Cross-device testing: iPhone Safari, Android Chrome, desktop Chrome versions
- Verify autofill against a clean Dutchie receiving page and against one with existing in-progress rows
- Verify all UI surfaces match trakie.ai visual identity
- Verify only Inventory Receiving tab exists
- Deliver raw video file to Steven
- Submit Milestone 3 for Steven's review

### M3 Dependencies from Steven

- **Live Dutchie receiving page access** from a dispensary with test data (blocking for W1)
- **Screenshots or screen recording** of Dutchie's receiving form in action — URL pattern, DOM structure, dropdown behavior (blocking for W1)
- **Merge-strategy call**: per-capture rows vs. labels-merge-into-invoice-by-batch (W2)
- **Claude model call**: Sonnet vs. Opus (W2)
- **Real-looking invoice + label images** for the demo video (W3)
- **Video editing / voiceover** after raw file delivery (W3)
- **trakie.ai deployment credentials** if not already provisioned (W3)

---

## Month 4 — Milestone 4: DOM Autofill Hardened & Handoff

(Replaces the original "Official Dutchie API Live" milestone. GraphQL integration is indefinitely deferred until/unless Dutchie reopens their partner program.)

### W1 — Adapter Layer & Selector Resilience

- Refactor the content-script autofill into a clean adapter interface: `fillField(fieldName, value)` abstraction, currently backed by DOM manipulation, designed to swap to GraphQL with zero calling-code change if Dutchie ever reopens
- Selector resilience pass: prefer ARIA roles, labels, and `data-*` attributes over class names or DOM position; fail loudly when a selector misses, never silently
- Handle Shadow DOM / iframe cases surfaced during M3 — document which fields live where
- Document the Dutchie follow-up cadence — confirm bi-weekly outreach to Monifa Foluke is logged in case their roadmap shifts

### W2 — Edge Cases & Merge Logic

- Dutchie session expiry: detect unauthenticated state, surface a clear CTA in the popup ("Log in to Dutchie to finish autofill"), hold the payload
- Combobox/dropdown handling: type + pick the matching option for Category, Subcategory; verify selection committed (not just typed)
- Multi-row handling: append vs. replace behavior when a second session fires while rows already exist; default append, confirm with Steven
- Per-capture vs. per-SKU merge: if Steven prefers SKU-level merge, implement `batchLotNumber` / `productName` matching
- Partial write failures: if field N fails mid-fill, preserve fields 1..N-1, flag N in the popup, don't roll back

### W3 — Breakage Detection & Monitoring

- **Dutchie UI changes are the #1 long-term risk.** Build loud failure: if the content script can't find the form within a timeout after the user loads Dutchie, surface a visible banner in the popup ("Autofill unavailable — Dutchie UI may have changed")
- Add lightweight telemetry: count successful vs. failed autofills per field, log unrecognized DOM shapes — gives Steven a signal that selectors need updating before users complain
- Optional dry-run mode: "preview autofill" showing intended values per row before writing (safer, slower — decide with Steven)
- Verify end-to-end performance still under 15 seconds with autofill running against real Dutchie (DOM writes are local, so should be fine, but confirm)

### W4 — Final QA, Documentation & Handoff

- Full regression against updated acceptance criteria (Section 11 of SOW, minus "API live"): QR bridge from any network, auto-capture, vibrations, all fields extracted and autofilled into live Dutchie, under 15 seconds, visual match, single tab, demo live, video delivered
- Write developer documentation: architecture overview, content-script / adapter design, setup instructions, environment variables, deployment steps, selector-maintenance playbook (how to update when Dutchie changes their UI)
- Verify all code is in Trakie private GitHub, no code on personal accounts
- Verify all API keys are in environment variables, nothing committed
- Remove Trakie code from personal devices
- Submit Milestone 4 for Steven's review

### M4 Dependencies from Steven

- **Continued Dutchie test-account access** throughout the month for regression and edge-case testing
- **Merge strategy sign-off** (W2) if not resolved in M3
- **Dry-run mode decision** (W3) — ship or skip
- **Documentation review pass** (W4) before handoff

---

## Summary (updated)

| Month | Milestone | Key Outcome |
|-------|-----------|-------------|
| 1 | QR Code Bridge | Extension ↔ phone connected via QR, auto-capture working |
| 2 | AI Reads a Real Invoice | Claude Vision extracts all fields, streams to desktop in real time |
| 3 | Demo Complete | **Live Dutchie** receiving form autofills in under 15 seconds, demo video recorded, Demo tab live on trakie.ai |
| 4 | DOM Autofill Hardened | Resilient selectors, breakage detection, merge/edge cases, full handoff documentation. GraphQL path preserved via adapter in case Dutchie reopens. |

## Dependencies & Blockers to Watch

- **M3W1 blocker:** Live Dutchie receiving page access and reference screenshots/recording from Steven. Without these, the content script can't be built and the demo can't be recorded.
- **Ongoing:** Dutchie UI changes can break autofill at any time — breakage detection (M4W3) is load-bearing for long-term operability.
- **Ongoing:** Bi-weekly Dutchie outreach continues; if partner access is granted later, the adapter layer makes a GraphQL swap a bounded change rather than a rewrite.
- **Ongoing:** Monday progress updates to Steven, 24-hour blocker flagging.
