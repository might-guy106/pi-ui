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

Dev dependencies track the installed pi runtime (currently 0.85.x). If npm
resolves `@earendil-works/*` against the org artifactory registry and fails,
install with the public registry:

```bash
npm install -D --registry=https://registry.npmjs.org \
  @earendil-works/pi-coding-agent@<version> \
  @earendil-works/pi-tui@<version> \
  @earendil-works/pi-ai@<version>
```

## Publishing a New Version

```bash
npm version patch   # or: minor | major
git push origin main
git push origin --tags
```

That's it — pushing the tag triggers GitHub Actions which publishes to npm and creates a GitHub Release automatically.

## One-time Secrets Setup

The workflow needs an `NPM_TOKEN` repo secret:
1. Generate an Automation token at [npmjs.com](https://www.npmjs.com) → Account → Access Tokens
2. Add it at `https://github.com/might-guy106/pi-ui/settings/secrets/actions` → name it `NPM_TOKEN`

## Troubleshooting

| Problem | Fix |
|---|---|
| Workflow not triggered | `git push origin --tags` |
| Tag/version mismatch | Delete tag, fix `package.json`, re-tag |
| `403` on npm publish | Regenerate `NPM_TOKEN` and update repo secret |

To re-push a tag:
```bash
git tag -d vX.Y.Z && git push origin --delete vX.Y.Z
git tag vX.Y.Z && git push origin vX.Y.Z
```
