# Extension Review Screen (mirror of mobile completion view)

## Goal

On `session:complete`, the extension popup currently shows a small banner above its grouped extraction list. That's good enough to signal "done". A richer alternative is to mirror the mobile completion screen — thumbnails + full per-capture extracted data + confidence dots — so the desktop user can scroll/review before committing.

This is **optional** and arguably redundant with the mobile screen. Revisit only if we find desktop users asking for it.

## Trade-offs vs current banner

Pro:
- One place on the desktop shows the full session result.
- Useful if the mobile device has been handed off / closed by the time autofill happens.

Con:
- Requires the extension to retain base64 images (it currently only logs byte counts and discards them in `image:captured`). Extra memory inside the popup process.
- Duplicates UX already built on mobile — more code, two places to keep in sync.
- Probably obsoleted once Dutchie autofill (see `dutchie-autofill.md`) ships — the Dutchie form *is* the review surface.

## If we do it

Minimum changes:
- In `popup.ts`, retain `imageData` on the `CaptureGroup` struct.
- Swap `showSessionBanner` for a larger completion view that hides the scrolling list and instead renders a grid of cards — thumbnail + group summary — matching `mobile/src/app/receive/page.tsx:CompletionScreen`.
- Keep a "Back to live view" affordance in case the user wants to see the streamed list again.

## Decision

Ship banner-only for now. Reconsider after Dutchie autofill — most users will leave the extension once autofill fires.
