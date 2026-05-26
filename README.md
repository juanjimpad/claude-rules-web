# Claude Rules Web

Web marketplace for [claude-rules](https://github.com/juanjimpad/claude-rules) — browse and install behavior rules for Claude Code from any browser.

## What it does

Fetches `rules/index.json` from `juanjimpad/claude-rules` (and any extra repos you add) and renders them as cards. Clicking **Install** copies the install command to your clipboard.

## Add more sources

Click **+ Add repository** and paste any GitHub repo URL. It supports:
- `rules/index.json` — native format
- `.claude-plugin/marketplace.json` — plugin marketplace format

## Tech

Static site deployed on Cloudflare Workers via [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```
wrangler deploy
```

## Related

- [juanjimpad/claude-rules](https://github.com/juanjimpad/claude-rules) — the rules repository
