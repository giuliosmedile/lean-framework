#!/usr/bin/env bash
# Publish ./wiki to the GitHub wiki of this repository.
#
#   scripts/publish-wiki.sh            # dry run: build the wiki tree, show what would change
#   scripts/publish-wiki.sh --push     # commit and push to the GitHub wiki
#
# Sources live in wiki/*.md and use `[text](Page.md)` links so they work when browsed in the repo.
# GitHub wiki links must not carry the .md extension, so this script strips it from the copy it publishes.
#
# One-time setup: GitHub only creates <repo>.wiki.git after the first page exists. Open
# https://github.com/giuliosmedile/lean-framework/wiki, click "Create the first page", save anything,
# then run this script with --push (it overwrites every page).
set -euo pipefail

REPO_URL="${WIKI_REMOTE:-https://github.com/giuliosmedile/lean-framework.wiki.git}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/wiki"
PUSH=0
[ "${1:-}" = "--push" ] && PUSH=1

[ -d "$SRC" ] || { echo "no wiki/ directory at $SRC" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if ! git clone --quiet "$REPO_URL" "$WORK/wiki" 2>/dev/null; then
  echo "Cannot clone $REPO_URL" >&2
  echo "The wiki repository does not exist until the first page is created in the GitHub UI (see header)." >&2
  exit 1
fi

# Replace the wiki's content with ours (keep .git).
find "$WORK/wiki" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
for f in "$SRC"/*.md; do
  # [text](Page.md) and [text](Page.md#anchor) -> [text](Page) / [text](Page#anchor); absolute URLs are untouched.
  sed -E 's/\]\(([A-Za-z0-9_][A-Za-z0-9_-]*)\.md(#[^)]*)?\)/](\1\2)/g' "$f" > "$WORK/wiki/$(basename "$f")"
done

cd "$WORK/wiki"
git add -A
if git diff --cached --quiet; then
  echo "Wiki already up to date."
  exit 0
fi

git --no-pager diff --cached --stat
if [ "$PUSH" -eq 1 ]; then
  git commit --quiet -m "Sync wiki from wiki/ ($(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown))"
  git push --quiet origin HEAD
  echo "Pushed."
else
  echo "Dry run. Re-run with --push to publish."
fi
