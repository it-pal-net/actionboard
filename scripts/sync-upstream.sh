#!/usr/bin/env bash
# Sync the fork with upstream Excalidraw: fast-forward master to
# upstream/master, then merge master into develop. See ACTIONBOARD.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n $(git status --porcelain) ]]; then
  echo "Working tree is not clean — commit or stash first." >&2
  exit 1
fi

# A fresh clone of this fork only has `origin`, so create the upstream remote
# on first run rather than failing on the fetch below.
if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Adding the upstream remote (excalidraw/excalidraw)…"
  git remote add upstream https://github.com/excalidraw/excalidraw.git
fi

git fetch upstream --prune

git checkout master
git merge --ff-only upstream/master
git push origin master

git checkout develop
# On conflict this stops with the merge in progress: resolve on develop,
# commit, then push.
git merge master
git push origin develop
