# Development Guide

## Local Setup

```bash
git clone git@github-personal:might-guy106/pi-ui.git
cd pi-ui
git config user.email "pankajnath1724@gmail.com"
git config user.name "Pankaj Nath"
pi install ./
```

## Tests and Checks

```bash
npm run typecheck   # tsc --noEmit against the installed pi packages
npm run lint        # eslint
npm test            # smoke tests: config/loader + user-zone rendering
```

The smoke tests run the real TypeScript sources with Node type stripping
(`--experimental-transform-types`) and assert on the actual rendered output of
the editor zone for every style and input frame.

## Pi version

Dev dependencies track the installed pi runtime (currently 0.85.x). `npm` on this machine defaults to the company artifactory, which does not carry the `@earendil-works/*` packages — use the public registry:

```bash
npm install -D --registry=https://registry.npmjs.org \
  @earendil-works/pi-coding-agent@<version> \
  @earendil-works/pi-tui@<version> \
  @earendil-works/pi-ai@<version>
```

Anything that touches the registry (installs, `npm publish`) should pass `--registry=https://registry.npmjs.org`.

## Publishing a New Version

The release convention is a bare-version commit (`1.9.0`, not `v1.9.0`) plus a `v`-prefixed tag:

```bash
npm version patch --no-git-tag-version   # or: minor | major
# commit message: the bare version, e.g. "1.9.0"
git add package.json package-lock.json && git commit -m "1.9.0"
git tag v1.9.0
git push origin main --tags
```

That's it — pushing the tag triggers GitHub Actions (`.github/workflows/release.yml`) which:

1. Validates the tag matches `package.json`'s version (fails the run on mismatch),
2. Skips publishing if that version already exists on npm (safe to re-run a tag),
3. Publishes to npm with provenance using the `NPM_TOKEN` repo secret,
4. Creates a GitHub Release with generated notes.

You never publish from your machine — the expired local token in `~/.npmrc` doesn't matter for releases.

## One-time Secrets Setup

The workflow needs an `NPM_TOKEN` repo secret:
1. Generate an Automation token at [npmjs.com](https://www.npmjs.com) → Account → Access Tokens
2. Add it at `https://github.com/might-guy106/pi-ui/settings/secrets/actions` → name it `NPM_TOKEN`

## Troubleshooting

| Problem | Fix |
|---|---|
| Workflow not triggered | `git push origin --tags` |
| Tag/version mismatch | Delete tag, fix `package.json`, re-tag |
| `403` on npm publish (in the workflow) | Regenerate `NPM_TOKEN` and update repo secret |

To re-push a tag:
```bash
git tag -d vX.Y.Z && git push origin --delete vX.Y.Z
git tag vX.Y.Z && git push origin vX.Y.Z
```
