# Verification

最終確認日: 2026-07-28

## Acceptance checks

| Check | Result | Evidence |
| --- | --- | --- |
| Simulation tests | PASS: 7 tests | `npm test` |
| TypeScript and production build | PASS | `npm run build` |
| Repository hygiene | PASS | `npm run check` |
| Browser smoke tests | PASS: 2 tests | `npm run test:browser` |
| Desktop flow | PASS | Contract -> route -> two event choices -> receipt -> restart |
| Mobile layout | PASS | 390 x 844 viewport screenshot |

## Reproduce locally

```bash
npm install
npm test
npm run build
npm run check
npm run test:browser
```

The browser suite starts Vite on `127.0.0.1:4173`, completes a seeded run, checks both event choices and the receipt, checks restart, and checks that the HUD remains readable on a mobile viewport. Screenshots are generated under `evidence/` for local inspection and are intentionally ignored by Git.

If Chromium is not installed, choose a writable cache outside the repository and run `npx playwright install chromium` with `PLAYWRIGHT_BROWSERS_PATH` set to that cache before running the browser suite.

## Known tradeoff

Phaser makes the production bundle larger than a DOM-only prototype. The current build remains acceptable for this feasibility test because it has no remote asset or runtime network dependency. Bundle splitting is a follow-up only if the prototype survives the next playtest.
