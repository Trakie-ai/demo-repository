# Dutchie DOM Autofill

## Goal

When the user taps **Done** on the mobile PWA, the extension takes the accumulated Dutchie records it has built up and writes them into Dutchie's receiving form (new inventory intake), so the operator lands in Dutchie with line items pre-populated instead of typing them by hand.

This is the endgame of the receiving flow. Everything upstream (invoice capture → Claude Vision extraction → extension popup) exists to feed this step.

## Why DOM autofill (not API)

Dutchie rejected us from their partner program in April 2026, so there is no official API access path. DOM autofill is the only route for the demo. Implications:

- Brittle to Dutchie UI changes. Selectors need to be resilient (prefer roles, labels, `data-*` attributes if present) and fail loudly, not silently.
- Must run from a content script — the popup can't reach into the Dutchie page's DOM directly.
- Will break in Dutchie's admin UI refreshes. Accept this; flag clearly in the extension when autofill can't find the form.

## Starting state at Done

`extension/src/popup.ts` already builds up `DutchieRecordWithMeta[]` per capture group via `applyFieldToRecord`. When `session:complete` fires, these records are the autofill payload.

Shape per record (see `extension/src/dutchie/types.ts`):

```
productName, brand, category, subcategory,
thc, cbd, netWeightOrUnitCount, batchLotNumber,
expirationDate, packageIdMetrcTag,
wholesaleCostPerUnit, retailPrice,
ingredients, allergens,
vendorName, quantityReceived
```

Each field has a `value` plus `meta.confidence` (green/red) and `meta.needsReview`. Confidence is binary: green means the extractor is confident and the field can fill silently; red means the field needs human review (uncertain, partially legible, inferred, or missing).

## Proposed architecture

1. **Content script** injected into Dutchie receiving page URLs.
   - Manifest `content_scripts` entry, matching the receiving form URL pattern (TBD — inspect live).
   - Exposes a `window.postMessage` handshake or uses `chrome.runtime.sendMessage` from popup.
2. **Popup → content script handoff**, triggered on `session:complete`.
   - Popup sends `{ type: "TRAKIE_AUTOFILL", records }` via `chrome.tabs.sendMessage` to the active Dutchie tab.
   - If no Dutchie tab is open, show a CTA in the popup ("Open Dutchie receiving to autofill") that links to the known URL and caches the payload until a matching tab exists.
3. **Field mapping layer** in the content script.
   - Map each `DutchieReceivingRecord` key → selector + input strategy (text input vs dropdown vs date picker).
   - Dropdowns are the scary part: Dutchie likely uses its own combobox components, so "type + pick matching option" logic is probably needed.
   - Fire native `input` / `change` events after setting values so React-controlled inputs don't discard the write.
4. **Per-field confidence surfacing**.
   - Red fields should end up visually flagged in Dutchie (e.g., a tooltip badge or a background color applied via injected CSS) so the operator knows to review them.
   - Green fields fill silently, optionally with a small checkmark indicator to signal "verified by Trakie".
5. **Row handling**.
   - Invoice captures produce multiple line items; labels produce one each. Decide:
     - One row per invoice line item + one row per label?
     - Or: labels merge into invoice rows by `batchLotNumber` / `productName` match?
   - Merge strategy is the harder UX question. Start with naive "one row per capture record" and iterate.

## Open questions

- **Which Dutchie page exactly?** Need the real URL pattern + screenshots of the receiving form DOM to design selectors. Shadow DOM? iframes?
- **Auth session handling.** Does the content script need to wait for Dutchie to finish its own hydration before writing? Probably yes — use a `MutationObserver` for the form container.
- **Undo / dry-run.** Should there be a "preview autofill" step where the user confirms each row before values are written? Safer, but slower.
- **Dedup across sessions.** If the user runs two sessions back-to-back, does the second session's autofill append rows or replace them? Append is probably right, but flag it.

## Dependencies before starting

- Live Dutchie receiving page access from a dispensary with test data.
- A recording / screenshots of the form in action.
- Confirmation on merge strategy (per-capture vs per-SKU rows).

## Non-goals

- Bidirectional sync. Once we write, Dutchie owns the data.
- Batch uploading / CSV. DOM-level writes only.
- Supporting anything other than the receiving form (e.g., purchase orders, transfers).

## Related files (today)

- `extension/src/dutchie/types.ts` — record shape + field order + labels.
- `extension/src/dutchie/mapper.ts` — `applyFieldToRecord` already handles extraction → record mapping with confidence tracking.
- `extension/src/popup.ts` — holds the `groups: CaptureGroup[]` which owns records. The `session:complete` handler is the natural trigger point.
- `extension/manifest.json` — needs `content_scripts` and `host_permissions` for Dutchie when this lands.
