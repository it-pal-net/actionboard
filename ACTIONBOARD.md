# ActionBoard — Excalidraw fork

ActionBoard is a fork of [Excalidraw](https://github.com/excalidraw/excalidraw)
that is expected to diverge substantially from upstream while staying cheap to
sync with it. This document defines the branch model and the rules that keep
upstream merges from turning into conflict hell.

## Branch model

| Branch    | Role                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `master`  | Pristine mirror of upstream Excalidraw `master`. Never commit here — it only ever fast-forwards to `upstream/master`.        |
| `develop` | The ActionBoard line, branched from `master`. Only ActionBoard commits and merge commits from `master` land here.            |

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

Conflicts are only ever resolved in the merge commit on `develop`; `master`
must never carry a commit that upstream doesn't have.

## Divergence rules — replace, don't rewrite

Upstream files stay as close to pristine as possible; ActionBoard behavior
lives in our own files, which upstream will never touch.

1. **Own code goes in own directories.** New components, modules, and app code
   live in ActionBoard-owned locations (`actionboard-*` directories, e.g.
   `packages/actionboard-*/`, `actionboard-app/`). Upstream never writes
   there, so these files can never conflict.
2. **To change an upstream component, don't edit it in place.** Copy it into
   an ActionBoard-owned location (or wrap it), modify the copy, and switch the
   import at the smallest possible number of call sites. When upstream later
   rewrites the original, the merge is clean — you diff the original against
   your copy on your own schedule, not under merge pressure.
3. **When an in-place edit is unavoidable, keep it to a hook point** — ideally
   one import plus one call — and push the actual logic into an ActionBoard
   module. A one-line divergence merges trivially; a rewritten function does
   not.
4. **Log every touched upstream file** in the divergence log below, so every
   upstream merge can be audited against a known list instead of a surprise
   diff.

## Divergence log

Every upstream file we modify or replace gets a row here.

| Upstream file | Kind of change | Replaced by / notes |
| ------------- | -------------- | ------------------- |
| _(none yet)_  |                |                     |
