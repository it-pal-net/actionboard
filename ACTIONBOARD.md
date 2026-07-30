# ActionBoard — Excalidraw fork

ActionBoard is a fork of [Excalidraw](https://github.com/excalidraw/excalidraw) that is expected to diverge substantially from upstream while staying cheap to sync with it. This document defines the branch model and the rules that keep upstream merges from turning into conflict hell.

## Branch model

| Branch | Role |
| --- | --- |
| `master` | Pristine mirror of upstream Excalidraw `master`. Never commit here — it only ever fast-forwards to `upstream/master`. |
| `develop` | The ActionBoard line, branched from `master`. Only ActionBoard commits and merge commits from `master` land here. |

Remotes:

- `origin` → `it-pal-net/actionboard` (this fork)
- `upstream` → `excalidraw/excalidraw` (the original)

## Syncing with upstream

Run `./scripts/sync-upstream.sh`, or manually:

```bash
git fetch upstream --prune
git checkout master
git merge --ff-only upstream/master   # master must always be identical to upstream
git push origin master
git checkout develop
git merge master                      # conflicts, if any, are resolved here only
git push origin develop
```

Conflicts are only ever resolved in the merge commit on `develop`; `master` must never carry a commit that upstream doesn't have.

## Building the packages

Consumers use the built dists (`packages/*/dist`), which are gitignored — so build after every checkout/merge, and after changing package source:

```bash
corepack yarn install --frozen-lockfile
corepack yarn build:packages
```

(`packageManager` pins yarn 1.22.22; corepack ships with Node and fetches it.)

## How Cardscape consumes this fork

The npm package names stay `@excalidraw/*` on purpose: nothing here is ever published, and renaming the scope would put every import line in this monorepo in permanent conflict with upstream. "ActionBoard" is the fork's identity, not a package scope.

The Cardscape repo keeps this fork checked out at `actionboard/` on `develop` — a sibling repo that Cardscape **gitignores rather than vendoring as a submodule**, so fork commits never turn into pointer bumps over there (the trade-off: Cardscape pins no fork revision, and a fresh Cardscape clone must clone and build this repo before its `npm install`). Its apps depend on the packages through `file:` links — `@excalidraw/excalidraw` plus the siblings it needs at exact versions the registry doesn't publish (`common`, `element`, `math`, `fractional-indexing`; only `0.18.0-<hash>` prereleases exist on npm). npm installs the links as symlinks and satisfies those exact-version deps from the link targets' real versions. At runtime, module resolution walks each symlink's real path, so the packages' own dependencies come from THIS repo's `node_modules` — the other reason `yarn install` must have run here. The consuming Vite apps pin `resolve.dedupe: ["react", "react-dom"]` so the fork's react copy never loads beside the app's and breaks hooks.

## Divergence rules — replace, don't rewrite

Upstream files stay as close to pristine as possible; ActionBoard behavior lives in our own files, which upstream will never touch.

1. **Own code goes in own directories.** New components, modules, and app code live in ActionBoard-owned locations (`actionboard-*` directories, e.g. `packages/actionboard-*/`, `actionboard-app/`). Upstream never writes there, so these files can never conflict.
2. **To change an upstream component, don't edit it in place.** Copy it into an ActionBoard-owned location (or wrap it), modify the copy, and switch the import at the smallest possible number of call sites. When upstream later rewrites the original, the merge is clean — you diff the original against your copy on your own schedule, not under merge pressure.
3. **When an in-place edit is unavoidable, keep it to a hook point** — ideally one import plus one call — and push the actual logic into an ActionBoard module. A one-line divergence merges trivially; a rewritten function does not.
4. **Log every touched upstream file** in the divergence log below, so every upstream merge can be audited against a known list instead of a surprise diff.

## Divergence log

Every upstream file we modify or replace gets a row here.

| Upstream file | Kind of change | Replaced by / notes |
| --- | --- | --- |
| `packages/excalidraw/renderer/staticScene.ts` | hook (import + guarded condition in `renderLinkIcon`) | card embeds render no link icon — predicate lives in `packages/excalidraw/actionboard/cardEmbeds.ts` |
| `packages/excalidraw/components/hyperlink/helpers.ts` | hook (import + guarded condition in `isPointHittingLink`) | card embeds expose no link hover/click target — same ActionBoard module |
| `packages/excalidraw/fonts/ExcalidrawFontFace.ts` | hook (fallback push guarded by `urls.length === 0`) | esm.sh font fallback only when no `EXCALIDRAW_ASSET_PATH` URL resolved — a dead CDN source trips strict `font-src` CSPs |
| `packages/element/src/transformHandles.ts` | hook (import + omit line in `getTransformHandlesFromCoords`) | the dedicated rotation handle is removed — rotation starts from the ring outside the corner handles; logic in `packages/element/src/actionboard/cornerRotation.ts` |
| `packages/element/src/resizeElements.ts` | hooks (import + one angle-adjust line in `rotateSingleElement` and `rotateMultipleElements`) | corner-started rotations are relative (no jump) — `abAdjustRotationAngle`, same ActionBoard module |
| `packages/element/src/index.ts` | hook (one `export * from` line) | exposes `actionboard/cornerRotation` to the excalidraw package |
| `packages/excalidraw/components/App.tsx` | hooks (2 imports + 3 call sites: `handleSelectionOnPointerDown` top + before the `resize.handleType` branch, and the hover block in `handleCanvasPointerMove`) | connector dots start arrows, corner ring arms rotation, hover cursors — `packages/excalidraw/actionboard/connectorDots.ts` + `packages/excalidraw/actionboard/cornerRotation.ts` |
| `packages/excalidraw/renderer/interactiveScene.ts` | hook (import + one render call after the selection block) | paints the connector dots — `packages/excalidraw/actionboard/connectorDots.ts` |
| `packages/excalidraw/components/App.cursor.ts` | branch removed in `applyForTool` | custom tools no longer reset to `auto` — a host `setCursor` (e.g. Cardscape's comment-tool bubble) survives the per-pointermove `applyForTool()`, honoring upstream's own "let host decide" comment |
| `packages/excalidraw/components/canvases/StaticCanvas.tsx` | hook (import + one line in `getRelevantAppStateProps`) | connector-dot hover writes `hoveredElementIds`, which must not repaint the static scene — `abStaticHoveredElementIds` |
| `packages/excalidraw/tests/helpers/ui.ts` | test shim (`rotateViaCornerRing` + side-handle grab offset in `transform`) | `UI.rotate` drives the corner ring with legacy top-handle delta semantics; `UI.resize` grabs side handles off-midpoint (the midpoint belongs to the connector dot) |
| `packages/element/tests/binding.test.tsx` | test edit (rotation-handle grab → `UI.rotate`) | the direct rotation-handle grab no longer exists |
| `vitest.config.mts` | config (radix-ui `server.deps.inline` + `use-sync-external-store/shim` alias) | node ≥ 22 rejects radix's directory import when externalized — without this the component suite cannot collect |
| various `__snapshots__/*.snap` + inline snapshots (`move.test.tsx`) | regenerated (`yarn test:update`) | render counts / version nonces shift with the hover-driven repaints and the new rotation flow |
| `CLAUDE.md` | prepended section | "ActionBoard fork rules — read first" pointing here, so AI agents load the divergence rules automatically |
