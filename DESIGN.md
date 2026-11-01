# Maayasthra People: design guide

The portal follows the **Untitled UI** design language (the open-source React starter kit, MIT licence), adapted to our stack:
plain CSS tokens instead of Tailwind, and our own icons instead of `@untitledui/icons`. The kit's rules were read from its
`CLAUDE.md` and `src/styles/theme.css`. Where this file and the kit differ, this file wins, because it describes what the
portal actually does.

All styling lives in two files, in this order: `src/styles.css` (structure and older rules) then `src/untitled.css`
(the Untitled UI layer: tokens and components). **New work goes in `untitled.css` and uses the tokens below. Do not write
raw colours.**

## 1. Principles

- Calm and neutral. Colour is for meaning: the brand colour marks the main action and the active item, green / amber / red
  mark status. Everything else is grey.
- Flat surfaces with a hairline border and a very light shadow. No gradients on surfaces, no glass, no heavy shadows.
- One radius scale, one shadow scale, one type scale. Nothing is sized by eye.
- Light and dark are equal. Every token below has a value for both. The theme is set on `<html data-theme="light|dark">`
  (`src/theme.js`) and the default follows the device.
- Touch first on phones: controls are at least 40px tall.

## 2. Colour tokens

Neutral scale (Untitled UI "neutral"): 25 `#FCFCFC`, 50 `#FAFAFA`, 100 `#F5F5F5`, 200 `#E5E5E5`, 300 `#D4D4D4`, 400 `#A3A3A3`,
500 `#737373`, 600 `#525252`, 700 `#404040`, 800 `#262626`, 900 `#171717`, 950 `#0A0A0A`.

Brand scale (the Maayasthra orange; **`#FE6D00` is the brand and the primary button colour**): 25 `#FFFAF5`, 50 `#FFF4EB`, 100 `#FFE5D0`, 200 `#FFCBA0`,
300 `#FFA666`, 400 `#FF8433`, 500 and 600 `#FE6D00`, 700 `#E55F00` (hover). Orange text on white uses `#B03A00` (`--brand-text`) so it stays readable;
800 `#8A2E05`, 900 `#6E2808`, 950 `#451603`.

To change the brand colour, change only the `--brand-*` scale at the top of `untitled.css`.

Semantic colours: success `#079455` (50 `#ECFDF3`, 200 `#ABEFC6`, 700 `#067647`), warning `#DC6803`
(50 `#FFFAEB`, 200 `#FEDF89`, 700 `#B54708`), error `#D92D20` (50 `#FEF3F2`, 200 `#FECDCA`, 700 `#B42318`).

Use these roles, never the raw scale, in component CSS:

| Role | Token | Light | Dark |
| :-- | :-- | :-- | :-- |
| Page background | `--bg` | neutral-50 | neutral-950 |
| Card / input background | `--card`, `--surface` | white | neutral-900 |
| Raised / hover surface | `--card-hi`, `--card-hover` | neutral-100 / 50 | neutral-800 / 900 |
| Primary text (headings) | `--text` | neutral-900 | neutral-50 |
| Secondary text (labels, body) | `--text-2` | neutral-700 | neutral-300 |
| Tertiary text (supporting) | `--muted` | neutral-600 | neutral-400 |
| Placeholder, quiet icons | `--faint` | neutral-500 | neutral-500 |
| Border (default) | `--line` | neutral-200 | neutral-800 |
| Border (inputs, buttons) | `--line-hi` | neutral-300 | neutral-700 |
| Neutral fill | `--fill`, `--fill-hi` | neutral-100 / 200 | neutral-800 / 700 |
| Brand solid | `--accent` | brand-600 | brand-600 |
| Brand tint (selected, soft) | `--brand-tint` | brand-50 | brand-950 at 60% |
| Brand text / links | `--brand-text` | brand-700 | brand-300 |
| Success / warning / error text | `--ok-text`, `--warn-text`, `--err-text` | 700 | 400 |

## 3. Type

Font: **Inter** (400, 500, 600, 700). Numbers use tabular figures in tables and metrics.

| Use | Size / line | Weight |
| :-- | :-- | :-- |
| Page title | 30 / 38 (24 / 32 on phones) | 600, tracking -0.02em |
| Section / card title | 18 / 28 (16 / 24 for small cards) | 600 |
| Metric value | 30 / 38 | 600 |
| Body | 14 / 20 | 400 |
| Label, button, nav | 14 / 20 | 500 or 600 |
| Supporting text | 14 / 20 in `--muted` | 400 |
| Caption, badge | 12 / 18 | 500 |

Labels are sentence case, medium weight, never upper-case. Fields use 16px on phones so iPhones do not zoom.

## 4. Space, radius, shadow

- Spacing steps: 4, 8, 12, 16, 20, 24, 32, 40, 48. Page side padding 32px on desktop, 16px on phones.
- Radius: controls 8px (`--r-ctl`), cards 12px (`--r-card`), modals and sheets 16px (`--r-modal`), badges and avatars full.
- Shadows (`--shadow-xs` to `--shadow-xl`, from the kit): cards use `xs`; menus and popovers `lg`; modals `xl`. In dark mode
  surfaces are separated by border, not shadow.
- Focus: a 2px brand outline with a 2px offset on buttons and links; fields get a brand border and a 4px brand-tint ring.

## 5. Components

**Button** (`.btn`). Height 40px (`.sm` 36px, 40px on touch), radius 8px, 14px semibold, icon 20px with 8px gap.
- `pri`: brand orange `#FE6D00` fill, white text, with the kit's light emboss: a 1px inner edge, a soft top highlight and a faint bottom edge, hover `#E55F00`.
- `sec2` / `ghost` (secondary): white fill, 1px `--line-hi` border, secondary text, shadow-xs, hover neutral-50.
- `tertiary`: no fill or border, tertiary text, hover neutral-50.
- `danger`: error-600 fill, white text. Disabled is 50% opacity.
- Links look like text in `--brand-text`; underline on hover.

**Input** (`.inp`). 44px, radius 8px, white, 1px `--line-hi` border, shadow-xs, placeholder `--faint`. Focus: brand border plus
a 4px brand-tint ring. Error: error border and ring. Label above, 6px gap. Hint below in `--muted`.

**Card** (`.card`, `.pn`, `.tile`, ...). `--card` fill, 1px `--line` border, radius 12px, `shadow-xs`, 20px padding. A card inside a
card has no shadow.

**Badge** (`.pill`, status chips). Pill, 12px medium, 2px 10px padding, `colour-50` fill, `colour-700` text, `colour-200` ring.
Colours: grey, brand, success, warning, error.

**Featured icon** (`.tile-i`, `.an-i`, `.hi`). 40px, radius 10px, `colour-100` fill, `colour-600` icon, thin ring. Never a solid saturated
square.

**Navigation**. Sidebar white, 1px right border. Item: 14px semibold secondary text, 8px radius, icon in `--faint`.
Hover neutral-50. Active: neutral-100 fill, primary text, icon in brand. A count badge is a small brand pill.

**Tabs and segmented control** (`.seg`, `.apps2`). Neutral-100 track, 8px radius; the active segment is white with shadow-xs.

**Table / list rows**. Header row neutral-50, 12px medium tertiary text; rows separated by a 1px `--line`; hover neutral-50.

**Modal** (`.dlg`, `.sh`). White, radius 16px, `shadow-xl`, overlay neutral-950 at 60% with a light blur. Title 18px semibold,
supporting text tertiary, actions right aligned.

**Menu / popover** (`.menu`, `.nf-p`). White, radius 12px, 1px `--line`, `shadow-lg`, items 8px radius with neutral-50 hover.

**Avatar**. Round, 1px inner ring at 8% black.

## 6. Rules for new screens

1. Use tokens and the components above. If something is missing, add a token to `untitled.css`, not a one-off colour.
2. One primary button per view. Secondary actions are secondary or tertiary.
3. Keep copy short and in sentence case. Errors say what to do next.
4. Check both themes and a 375px phone before shipping. Tap targets are 40px or more.
5. Disabled things are faded, not recoloured.

**Nested radii.** An item inside a padded container uses the outer radius minus the padding: the check-in widget is 12px with 4px padding, so its button is 8px.
