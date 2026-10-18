# Aster brand

**Mark.** Six rounded petals around an amber centre: an asterisk, which is both "little star" (the flower's name) and the UML symbol for `*` multiplicity. Holds at 16 px.

**Wordmark.** "aster", lowercase, [Sora](https://fonts.google.com/specimen/Sora) 600, letter-spacing −0.04em, set beside the mark with a gap of about a quarter of the mark's height.

| Token           | Light                    | Dark      |
| --------------- | ------------------------ | --------- |
| Petal           | `#5A4BD6`                | `#8B7FF5` |
| Centre          | `#F2B233`                | `#F2B233` |
| Ink (wordmark)  | `#1B1A24`                | `#F3F2FA` |
| Tile background | `#5A4BD6` (white petals) | `#15141B` |

Files: `aster-mark.svg` / `aster-mark-dark.svg` (mark only, 100×100 viewBox), `aster-lockup.svg` / `aster-lockup-dark.svg` (mark + wordmark; the SVG references Sora by name, so embed or outline the font before using it outside a page that loads Sora), `aster-mark-256.png` / `aster-mark-dark-256.png`.

`src/lib/assets/favicon.svg` is the mark; PNG app icons (apple-touch, PWA 192/512 maskable) are generated from `aster-mark.svg` when the PWA lands in M3. The design canvas with the alternatives considered is "Aster Logo" in Claude.

Don't: recolour the centre to match the petals (it becomes a snowflake), rotate the mark, or set the wordmark in title case.
