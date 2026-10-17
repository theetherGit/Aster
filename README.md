# Aster

Aster is an open-source, browser-based UML class modeller. It reads and writes
StarUML `.mdj` files and runs entirely in the browser as a static site.

The specification lives in [`docs/spec/`](docs/spec/). Start with
`overview.md`, `architecture.md` and `data-model.md`.

## Development

Requires Node 24 and pnpm.

```sh
pnpm install
pnpm dev        # dev server
pnpm build      # static build into ./build
pnpm preview    # serve the build
pnpm test       # unit tests (Vitest)
pnpm test:e2e   # end-to-end tests (Playwright; run `pnpm exec playwright install` once)
pnpm lint       # Prettier check + ESLint
pnpm format     # Prettier write
pnpm check      # svelte-check (TypeScript)
```

Contributor rules are in [`CLAUDE.md`](CLAUDE.md). Deviations from the spec are
logged in [`DECISIONS.md`](DECISIONS.md).

## Licence

MIT. See [`LICENSE`](LICENSE).
