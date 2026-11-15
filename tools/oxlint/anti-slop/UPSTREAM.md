# Upstream

- Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-14), MIT (`LICENSE`, copied from the repository's root).
- Copied: the install skill's bundle, `skills/install-anti-slop/assets/anti-slop/`, whole, to `tools/oxlint/anti-slop/`. It is the repository's `src/` without its tests.
- Installed with it: `oxlint` and `@oxlint/plugins` 1.92.0, exactly (the rules import `@oxlint/plugins`; the two move together).
- Registered: `index.ts` as the `anti-slop` plugin in `.oxlintrc.json`, with every generic rule at `error` and `oxc/no-accumulating-spread`. The Effect rules (`effect/`) are copied but not registered: the demo does not depend on Effect.
- Deviations: none in the rules. `vendor/eslint-stylistic/` keeps its own `LICENSE` and `UPSTREAM.md`.
