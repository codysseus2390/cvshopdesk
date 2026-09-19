# Hub vs Figma — Dashboard diff (main)

**Compared:** live `/hub` on `main` @ `29a9a36`  
**Figma:** https://www.figma.com/design/1GarIodYxJ1rBaTeuFYSVp — page **Dashboard — Reference review** — frame **Reference — sample data** / Desktop editable (`4:12`)  
**Branch for this PR:** `docs/hub-figma-diff`  
**Out of scope:** app code, Pixel paint, PR #10, Lovable, merges

**Tokens (law):** oil black `#0B0B0C` · warm paper `#F3EEE6` · cedar flame `#F2581A` · stone muted `#9C968C`

**Preserve:** null ≠ 0 · partial month ≠ crash · no fake metrics · Bay locks 16, 18, 25–30

**Folded addenda:** icon-pop · no white chips · icon depth · Flare+ · logo fidelity · Tabler chrome

---

## 1. Numbered diff list

1. **Canvas** — Figma warm paper `#F3EEE6`. Hub `--background` cool pearl-green `oklch(0.975 0.012 160)`. Miss: wrong canvas hue.
2. **Stone muted** — `#9C968C` not mapped. Hub muted-foreground cooler blue-gray. Miss: caption color.
3. **Flame / oil black** — lock primary to `#F2581A`, sidebar base to `#0B0B0C` (hub sidebar is dark teal-black oklch).
4. **Sidebar width** — Figma `211px`. Hub `w-[212px]`.
5. **Logo** — Figma original mark `174×113` bare on oil black. Hub `CedarLogo` `/cedar-valley-logo.jpg` at `h-12` (~48px). Miss: scale + possible baked JPG plate. Restore original transparent PNG at Figma size. No white chip. No Tabler tree.
6. **Nav row** — Figma `43px` tall, icon `23`, label inset ~`52`. Hub `min-h-11`, Lucide `18px` @ ~0.85 opacity.
7. **Active nav** — flame fill pill; verify radius/contrast vs oil black.
8. **Header title** — Figma ~`40px`. Hub ~`1.75rem` / `text-2xl`.
9. **Tagline** — confirm “Same People. A Smoother Shop.” vs Figma placement.
10. **Search** — Figma `354×38`. Hub `h-10` rounded-full.
11. **DESIGN PREVIEW pill** — Figma-only. Hub omits. **No change.**
12. **Toolbar** — Figma: sun `18`, Dark Mode label, **bell-filled** `23`, avatar `34`, Cody+chevron, Sign out `74×34`. Hub cluster differs (no Dark Mode label, email initial).
13. **Date row** — one muted line + CTA `181×37` flame. Hub: split spans, CTA `h-10`.
14. **KPI card** — Figma height `224`, gap `12`, inset `13`. Hub `min-h-[13.5rem]` (~216), `gap-3`.
15. **KPI art** — Figma brand illustrations `76×80`. Hub Lucide in `48` white/colored **chips**. Miss: wrong iconography + **white chip ban**. Path A: brand art, no plate.
16. **KPI type** — value ~`58px` optical. Missing = “Not updated” (muted smaller), **never** `0` / `$0`.
17. **KPI support rows** — height `24`; divider under Previous day only; tabular nums.
18. **KPI sparkline** — area+curve ~`45px`; null gaps; no flat zero; drop “Completed months · year” caption if not in Figma.
19. **KPI border** — quieter border; accent via art/sparkline, not heavy tinted stroke.
20. **Middle row** — Figma `400 / 478 / 432` × `308`, gap `12`. Hub `xl:grid-cols-[1.02fr_1.14fr_1fr]` `gap-4`.
21. **Imports rows** — `58` tall, badge `44`, glyph ~`28–31`. Hub smaller (`h-9` badge). Status pills shop language later (Bay).
22. **Import actions** — `178×44` pair. Hub `h-10`.
23. **Notifications** — rows `62`, art `44`, “N new” pill, unread dots `10`. Hub Bell-in-circle chips — kill white/pale chips; prefer art or bare Tabler + soft contact shadow.
24. **TV poster** — `140×220` + Open TV `140×29`. Hub column `132px`, button `h-9`.
25. **Mechanic table** — header `44`, rows `65`, avatar `44`, MTD bar `80×8`. Hub compact `text-xs` / avatar `24` / bar `h-1.5 w-14`. Missing `%` = `—`, never `0%`.
26. **Monthly chart** — keep partial MTD callout separate; `connectNulls={false}`; do not draw current month as full-month crash-to-zero. That matches on data rules; plot height/styling still off Figma density.
27. **YTD + System settings** — padding/tiles to Figma; nulls “Not updated”.
28. **Loading** — hub: one sentence. Spec: skeleton geometry, **no zero numerals**.
29. **Error** — inline well; no fake metrics.
30. **Empty / no-data** — quiet empties; never null→0.
31. **Hover** — soft elevation one step (Flare+).
32. **Icon set** — **Tabler only** for chrome (closes Lucide). Brand art for KPI/TV. No mix.
33. **No white icon chips** — never white rounded square behind glyphs on dark or warm paper.
34. **Icon depth** — Tabler stroke `2`; filled where Figma filled; soft contact shadow under glyph/art only; no emboss on 18–23px chrome.
35. **Icon size (pop)** — nav `23`; search `20`; bell-filled `23`; panel headers `22–24` in `36–40` tinted (not white) tiles; oil black on warm paper.
36. **Flare+ material** — page grain ~`3–4%` on canvas only (not type/sparklines); stronger card inner highlight; thin flame seam sidebar→canvas ~`15–25%` opacity; soft CTA flame wash. No bounce on daily numbers.
37. **Label “Car count”** — Figma says Car count. Bay prefers Cars. **HUMAN / Cody** — Pixel must not invent.

---

## 2. Component state checklist

| Component | default | hover | pressed | focus | loading | disabled | empty | error | no-data |
|-----------|---------|-------|---------|-------|---------|----------|-------|-------|---------|
| MetricCard (dashboard) | art 76×80 + MTD value + rows + area sparkline | shadow +1 | — | flame ring | skeleton 224h, no zeros | — | “Not updated” | withhold values | sparkline empty / unavailable, not flat zero |
| RecentImportsPanel | 3 rows + CTAs | row chevron | — | — | 3 skeleton rows | — | “No import history…” | inline error | same as empty |
| NotificationsTvPanel | list + N new + poster | — | — | — | skeleton list | — | no notifs copy + poster stays | inline | — |
| MechanicProductivityPanel | Figma density table | — | — | — | skeleton table | — | `—` cells, no 0% bars | inline | — |
| Monthly chart | year lines + partial MTD badge | — | — | — | chart skeleton | — | dashed empty | inline | partial-month badge only |
| AppShell sidebar | oil black + logo 174×113 + Tabler 23 | nav hover | active flame pill | — | — | — | — | — | — |
| Enter today’s numbers CTA | 181×37 flame | lift | pressed darken | focus ring | — | disabled allowed | — | — | — |

---

## 3. Tabler icon links (chrome)

Pixel: Tabler only. Do not hunt.

| Slot | Icon | Link |
|------|------|------|
| Nav Dashboard (active) | home-filled | https://tabler.io/icons/icon/home-filled |
| Nav Hank | message-circle | https://tabler.io/icons/icon/message-circle |
| Nav Numbers | chart-bar | https://tabler.io/icons/icon/chart-bar |
| Nav Daily entry | edit | https://tabler.io/icons/icon/edit |
| Nav History | history | https://tabler.io/icons/icon/history |
| Nav Inventory | package | https://tabler.io/icons/icon/package |
| Nav Customers | users | https://tabler.io/icons/icon/users |
| Nav Jobs | calendar-event | https://tabler.io/icons/icon/calendar-event |
| Nav TV | device-desktop | https://tabler.io/icons/icon/device-desktop |
| Nav Tools / Mechanic header | tool | https://tabler.io/icons/icon/tool |
| Nav Account | user | https://tabler.io/icons/icon/user |
| Nav Settings | settings-filled | https://tabler.io/icons/icon/settings-filled |
| Search | search | https://tabler.io/icons/icon/search |
| Theme | sun | https://tabler.io/icons/icon/sun |
| Bell | bell-filled | https://tabler.io/icons/icon/bell-filled |
| Date row | calendar-event | https://tabler.io/icons/icon/calendar-event |
| Imports | file-description-filled | https://tabler.io/icons/icon/file-description-filled |
| Upload CTA | upload | https://tabler.io/icons/icon/upload |
| Chevron | chevron-right / chevron-down | https://tabler.io/icons/icon/chevron-right |
| Tires chrome interim (non-KPI) | circle-dotted or wheel metaphor | https://tabler.io/icons/icon/circle-dotted |

**KPI / TV:** brand illustrations — not Tabler. Custom tire tread SVG = later packet.

---

## 4. Motion note

**no motion needed** for this Pixel pass. Hub stays quiet. Do not @Flick unless Cedar tags a state change later.

---

## 5. Bay check

**needs Bay review** after this list (Wrench dispatches Bay next). Trust locks that must survive Pixel: **16, 18, 25, 26, 27, 28, 29, 30**. Cars vs Car count = Cody taste (#37).

---

## 6. Ready verdict

**NOT READY FOR PIXEL** — open blockers: KPI brand art vs Lucide chips (#15), canvas/token lock (#1–3), logo scale (#5), mechanic/notif density (#23–25), Cody taste Cars vs Car count (#37). Bay review still pending.

When Ready flips: Pixel paints this list + addenda only — no new look.
