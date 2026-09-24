# TV Shop Numbers visual verification

final result: passed

Scope: local rendering of the production TV presentation components. This is
not signed-in staging verification or production release approval.

## Sources and evidence

- Visual authority: user-supplied image,
  C:/Users/ivinb/AppData/Local/Temp/codex-clipboard-6e7e21f1-12bf-4c3f-8cea-3a3f52cbd1d8.png.
- Source dimensions: 1024 x 570 pixels.
- Reference-sized implementation: .tv-preview.local/final-1024.png.
- Full HD implementation: .tv-preview.local/final-1920.png.
- Missing-data/error state: .tv-preview.local/empty-1024.png.
- Browser: Codex in-app browser, 1024 x 570 and 1920 x 1080 CSS viewports.
  Screenshots use one image pixel per CSS pixel; no density rescaling.
- Local fixture: http://127.0.0.1:4185/.tv-preview.local/index.html.
  This ignored fixture supplies the photo's example values to the actual UI
  components. It is not a product route, never calls the backend, and is not
  included in the application build. Actual /tv retains its existing queries.

## Comparison history

1. Opened source and iteration-1.png together in the same tool result.
   P2: display lettering too narrow; mechanic table showed a scrollbar at
   reference dimensions; panels extended about ten pixels too far right.
2. Corrected optical letter width, clock/header position, right margin,
   footer proportions, and mechanic row height. Added metallic text highlights.
   Compared iteration-2.png with the source in the same tool result.
3. Refined count width, mechanic heading width and row spacing. Compared
   final-1024.png and the source directly; no remaining P0/P1/P2 findings.
   All three mechanic rows and all footer items are visible.
4. Checked missing metrics, absent mechanics/announcement, long prior-day label,
   update warning, no next appointment, and a two-digit clock hour at 1024 x 570.
   Missing metrics display dashes, never fabricated numbers.
5. Checked full HD layout at 1920 x 1080. No clipped cards or footer content.
   Browser console error inspection returned an empty array.

The full images were readable at native resolution, including the small table
and footer. Separate focused crops were not needed.

## Required fidelity surfaces

- Typography: locally bundled, licensed Anton with measured optical width;
  existing Oswald and Source Sans 3 for secondary text. Metallic silver/orange
  title and clock; large green/orange period values.
- Spacing: two columns, two rows, separate rounded illuminated cards; three
  adjacent reporting periods; compact announcement and status strip.
- Color: near-black surfaces, lime green and amber accents, pale blue upcoming
  icon, muted reporting labels and separators.
- Assets: original repository Cedar Valley logo; generated raster background
  reconstructed from the supplied reference; existing Lucide icon library.
- Copy/content: photo used only as a design/test fixture. Production retains
  queried values, real mechanic names, notifications, timezone-aware clock,
  previous-open-day date labels, and null-safe metric formatting.

## Remaining P3 differences and verification limits

- Raster texture/streaks, exact icon silhouettes and metallic highlights are
  close recreations, not pixel-identical extractions of the reference.
- Clock intentionally remains live. Production includes the previous-open-day
  date when supplied; the photo's shorter label is used only in the fixture.
- Signed-in /tv data loading, rotation, role/session boundaries, deployment and
  a physical shop TV still require the normal staging/release checks.
- More than three mechanic rows remain available through the table's overflow.
  No mechanic records are discarded to force the photo's example row count.

## Implementation checklist

- [x] Production presentation updated without backend/query changes.
- [x] Photo comparison and empty/error layout checked in a real browser.
- [x] Full HD layout checked; console error log empty.
- [x] Original dirty reporting checkout preserved in place.
- [ ] Signed-in exact-commit staging Preview and owner acceptance before release.
