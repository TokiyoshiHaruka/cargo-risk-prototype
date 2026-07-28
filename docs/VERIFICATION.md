# Verification

最終確認日: 2026-07-28

## Acceptance checks

| Check | Result | Evidence |
| --- | --- | --- |
| Simulation tests | PASS: 7 tests | `npm test` |
| Hygiene negative controls | PASS: 5 tests | `npm test` |
| TypeScript and production build | PASS | `npm run build` |
| Repository hygiene | PASS | `npm run check` |
| Browser smoke tests | PASS: 2 tests | `npm run test:browser` |
| Desktop flow | PASS | Contract -> route -> two event choices -> receipt -> restart |
| Mobile layout | PASS | 390 x 844 viewport screenshot |

## Reproduce locally

```bash
npm ci
npm test
npm run build
npm run check
npm run test:browser
```

The browser suite starts Vite on `127.0.0.1:4177` by default, completes a seeded run, checks both event choices and the receipt, checks restart, and checks that the HUD remains readable on a mobile viewport. Set `CARGO_RISK_PORT` when another local service needs that port. Screenshots are generated under `evidence/` for local inspection and are intentionally ignored by Git.

Latest local receipt environment: Windows, Node `v22.14.0`, npm `10.9.2`.
All listed commands exited with status `0`; browser verification used the default
isolated port `4177`.

If Chromium is not installed, choose a writable cache outside the repository and run `npx playwright install chromium` with `PLAYWRIGHT_BROWSERS_PATH` set to that cache before running the browser suite.

## Known tradeoff

Phaser makes the production bundle larger than a DOM-only prototype. The current build remains acceptable for this feasibility test because it has no remote asset or runtime network dependency. Bundle splitting is a follow-up only if the prototype survives the next playtest.
