# Figures

Bench pages and look sheets for the Hairline figures Aster draws itself; each folder is one figure, with the page the Hairline skill built (`hairline-<name>.html`, self-contained, open it in a browser) and the sheets its look produced.

They were made with `/hairline-adopt`, which reads a drawing (`docs/brand/aster-mark.svg` for the mark) and rebuilds it as a figure on Hairline's engine; the page is the design artifact, kept so the figure can be adjusted and re-checked.

`src/lib/figures/aster.ts` is extracted from `docs/figures/aster/hairline-aster.html`: the engine is that page's lines 73–786, byte for byte; the figure is its `mount` from the `hl-figure` script. Scratch for the next iteration goes in `.hairline/`, which is gitignored.
