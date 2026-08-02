# Development Guide

## Local Setup

```bash
git clone git@github-personal:might-guy106/pi-ui.git
cd pi-ui
git config user.email "pankajnath1724@gmail.com"
git config user.name "Pankaj Nath"
pi install ./
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
