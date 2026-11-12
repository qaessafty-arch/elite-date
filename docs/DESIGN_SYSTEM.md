# Design system

## Direction

Halden is a small wardrobe made from mill-end cloth. The site should feel like a printed lookbook from a careful tailor: warm, quiet, unhurried, with the photography doing the selling. One element per page carries the drama (the hero image, the Low Sun campaign block, the cloth study); everything around it stays disciplined.

## Colour tokens (`src/app/globals.css`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bone` | #F8F7F4 | #111111 | Page background |
| `--paper` | #FFFFFF | #1A1A19 | Panels, drawers, inputs |
| `--sand` | #EFEBE3 | #222120 | Image wells, quiet fills |
| `--ink` | #171717 | #F2EFE9 | Text, primary buttons |
| `--mute` | #6B6861 | #A8A49B | Secondary text (AA on bone) |
| `--line` / `--line-strong` | #E7E4DE / #CFCAC0 | #2B2A28 / #44423E | Hairlines, input borders |
| `--brass` / `--brass-deep` | #A58A63 / #7A6140 | #B89C73 / #CDB38C | Accent fill / accent text |
| `--loden` | #2E3427 | #1D2219 | Announcement bar, campaign, footer |
| `--danger`, `--ok` | #A3352A, #3D6A48 | lighter variants | Status |

The brief's suggested secondary text (#777777) was darkened to #6B6861 to pass WCAG AA on the bone background. Loden green replaces black for dark surfaces, so the site is never "all black".

## Type

- **Bodoni Moda** (variable, optical sizes): headings, prices in the admin dashboard, campaign titles. Set tight (−0.022em), never bold.
- **Hanken Grotesk** (variable): everything else, 15–17px body, 600 for labels and buttons.
- Scale: `.display-xl` clamp(44–112px), `.display-lg` (36–68px), `.display-md` (28–42px), `.display-sm` 24px, body 16–17px, `.small` 13px.
- Sentence case throughout. No all-caps eyebrows except the wordmark.

## Components

Buttons (`.btn-primary`, `.btn-secondary`, `.btn-light`, `.btn-outline-light`, `.btn-sm`), fields (`.field`, `.input`, `.field-error`), notices, tags, the accessible `Sheet` (drawer/modal with focus trap), `ActionForm` (server-action form with per-field errors), product card, filters, stars. Radius is 2px on controls and none on imagery.

## Motion

- One orchestrated moment: the hero image settles and the headline rises on load.
- Hero parallax via GSAP ScrollTrigger reads scroll position only; it never hijacks scrolling.
- Drawers slide with Framer Motion; product card hover swaps to the second image.
- The 3D cloth study loads three.js only when scrolled near, pauses off screen, and is labelled as a procedural illustration (not a scan of a garment).
- `prefers-reduced-motion` disables animation globally and in the canvas.

## Layout

Max width 1536px with 20/40/64px gutters. Collections use a staggered three-column wall; product grids are 2/3/4 columns. Mobile layouts are designed separately: bottom-sheet filters, compact header, round quick-add buttons, stacked checkout with sticky summary on desktop only.
