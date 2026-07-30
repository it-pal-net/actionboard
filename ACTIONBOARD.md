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

The Cardscape repo vendors this fork as a git submodule at `actionboard/` (checked out on `develop`), and its apps depend on the packages through `file:` links — `@excalidraw/excalidraw` plus the siblings it needs at exact versions the registry doesn't publish (`common`, `element`, `math`, `fractional-indexing`; only `0.18.0-<hash>` prereleases exist on npm). npm installs the links as symlinks and satisfies those exact-version deps from the link targets' real versions. At runtime, module resolution walks each symlink's real path, so the packages' own dependencies come from THIS repo's `node_modules` — the other reason `yarn install` must have run here. The consuming Vite apps pin `resolve.dedupe: ["react", "react-dom"]` so the fork's react copy never loads beside the app's and breaks hooks.

## Divergence rules — replace, don't rewrite

Upstream files stay as close to pristine as possible; ActionBoard behavior lives in our own files, which upstream will never touch.

1. **Own code goes in own directories.** New components, modules, and app code live in ActionBoard-owned locations (`actionboard-*` directories, e.g. `packages/actionboard-*/`, `actionboard-app/`). Upstream never writes there, so these files can never conflict.
2. **To change an upstream component, don't edit it in place.** Copy it into an ActionBoard-owned location (or wrap it), modify the copy, and switch the import at the smallest possible number of call sites. When upstream later rewrites the original, the merge is clean — you diff the original against your copy on your own schedule, not under merge pressure.
3. **When an in-place edit is unavoidable, keep it to a hook point** — ideally one import plus one call — and push the actual logic into an ActionBoard module. A one-line divergence merges trivially; a rewritten function does not.
4. **Log every touched upstream file** in the divergence log below, so every upstream merge can be audited against a known list instead of a surprise diff.

## Divergence log

Every upstream file we modify or replace gets a row here.

| Upstream file | Kind of change | Replaced by / notes |
| ------------- | -------------- | ------------------- |
| _(none yet)_  |                |                     |
