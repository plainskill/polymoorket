# Design — polymoorket

<!-- chosen via impeccable direction roll: challenger "medium-native-hypercard-stack-shoebox" (verdict: won, bolder register) -->

## World: The Shoebox Book

A HyperCard stack that is also a betting book. Every surface is a card in a shoebox; the tool you read the book with is the tool the admin writes it with. The parody lands because the stack genuinely works — buttons are hand-painted, states invert, and the book keeps real accounts.

## Palette

One bit. No color anywhere.

- `ink` `#000` — all type, borders, fills
- `paper` `#fff` — card stock, page ground
- stipple grays rendered as dot fields, five levels (`st1` 12% → `st5` 90%), never flat gray
- state = inversion: pressed/active/selected is solid ink with paper text

## Type

- **Display / menus / numerals:** Silkscreen (self-hosted via @fontsource), uppercase, the Chicago stand-in. Used for the wordmark, menu bar, card titles, buttons, all figures and balances.
- **Body / input text:** Geneva stack (`Geneva, Verdana, 'Lucida Grande', system-ui`). Descriptions, explanations, feed text.

## Materials & grammar

- **Hand-drawn card borders:** 2px ink with irregular border-radius (`255px 15px 225px 15px / 15px 225px 15px 255px` family). Every box, input, and button wobbles slightly.
- **The stack:** every page is a card; two offset outlines behind it show the rest of the stack. Navigation is a "STACK CONTENTS" column — numbered entries with 1-bit icons.
- **Buttons:** paper with ink border; `:hover` gets stipple-2; `:active` / selected state inverts to solid ink. Destructive is a label, not a color.
- **Rules:** dotted hairlines separate content inside a card.
- **Bottom pager:** "n of N" with ◀ ▶ arrows — the stack metaphor carried into chrome.
- **Motion:** one authored moment — the card deals in on route change (translate + slight rotate, expo ease-out, ~280ms). Reduced motion drops it to instant.
- **Currency:** beetcoin rendered `₿` (bitcoin's own glyph — the parody is built in).

## Modes

Operate, both surfaces. The admin's "back office" is the stack's author mode — same cards, more tools (a PAINT-mode cue in the menu bar).

## Anti-goals

No rounded-modern cards, no color-coded odds, no gradients-as-decoration, no glass. If it can't be printed on a 1987 LaserWriter, it doesn't ship.
