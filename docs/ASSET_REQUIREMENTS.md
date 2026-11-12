# Assets

All imagery was generated with Higgsfield (model `soul_2`, 2K) in this project. Exact prompts are in `assets-src/prompts.json` (written by `assets-src/gen.mjs`). PNG masters are kept out of git; `npm run images` (`scripts/images.mjs`) converts them, which writes optimised JPEGs to `public/images/`, and Next.js serves AVIF/WebP from those.

| Group | Files | Purpose |
| --- | --- | --- |
| Campaign | `hero`, `low-sun`, `atelier`, `cloth` | Homepage hero, seasonal campaign block, brand story, about page |
| Collections | six tiles | New arrivals, best sellers, Low Sun, streetwear, essentials, limited edition |
| Products | 32 studio and detail shots | One image per product colour, plus detail shots for denim, boots, tote and trench |

Every product image shows the actual product described in the catalogue, in the matching colour, on the same bone-paper backdrop, so the grid reads as one shoot.

## Credits and use

Images were generated for this demonstration store. They depict no real people and no real brand. Before commercial use, review Higgsfield's terms for generated content and replace them with photography of your real products.

## Still needed for a real launch

- Photography of real products, at least two angles per colour (front and back or detail).
- Optional short product videos (`products.video_url`).
- A logo file if you want one in place of the typeset wordmark (Admin → Settings → Brand).
