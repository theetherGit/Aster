# Feature request: an engine subpath export for custom figures

**Repository:** lucasmarkes/hairline · **Version:** 0.5.1

Figures made with the Hairline skill (`/hairline-adopt`) can't be shipped without vendoring the kernel, because the package exports only finished figures: no engine, no `create()`.

Our case: a SvelteKit app that uses three stock figures (`drawer`, `sieve`, `plug`) and one custom one, our product mark rebuilt with the skill. To ship it we pasted the skill's `kernel.js` (your `src/core`, unchanged) into our tree next to a copy of `create()` from `src/mount.ts`. Result: two engines in the bundle, two frame loops, two injected stylesheets. They match today, but every Hairline upgrade is now a "regenerate the vendored block and re-diff" task, and the copies can drift silently.

Proposed minimal API, a subpath export:

```ts
import { create } from '@lucasmarkes/hairline/engine';
```

exposing the kernel's public surface (what the skill's `HL` index lists) plus `create(spec, el, options)`, with `spec` the `{ id, label, rest, range, tour, engine }` your figures already pass. A custom figure then is `mount` plus `create(spec)`, with the same `(el, opts) => { update, destroy }` as the stock ones, and no second engine.

Happy to test a prerelease against our figure.
