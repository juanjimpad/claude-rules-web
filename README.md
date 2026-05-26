# Claude Rules Web

**[claude-rules.com](https://claude-rules.com/)** — Web marketplace for [claude-rules](https://github.com/juanjimpad/claude-rules). Browse and install behavior rules for Claude Code from any browser.

## What it does

Loads sources from `web/sources.json` and any extra repos the user adds via the UI, then renders them as cards. Clicking **Install** copies the install command to your clipboard.

## Default sources

Defined in [`web/sources.json`](web/sources.json). To add or remove a default repo, edit that file:

```json
{
  "sources": [
    {
      "label": "owner/repo",
      "rawBase": "https://raw.githubusercontent.com/owner/repo/main"
    }
  ]
}
```

Each source is fetched at startup. The app supports two formats:

- `rules/index.json` — native format
- `.claude-plugin/marketplace.json` — plugin marketplace format

Current default sources:

| Repo | Format |
| ---- | ------ |
| [juanjimpad/claude-rules](https://github.com/juanjimpad/claude-rules) | `rules/index.json` |
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | `marketplace.json` |
| [rohitg00/awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) | `marketplace.json` |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | `marketplace.json` |
| [anthropics/skills](https://github.com/anthropics/skills) | `marketplace.json` |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | `marketplace.json` |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | `marketplace.json` |
| [sangrokjung/claude-forge](https://github.com/sangrokjung/claude-forge) | `marketplace.json` |

## Add more sources at runtime

Click **+ Add repository** in the app and paste any GitHub repo URL. Extra sources are persisted in `localStorage` and merged with the defaults on every load.

## Tech

Static site deployed on Cloudflare Workers via [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```sh
wrangler deploy
```

## Related

- [juanjimpad/claude-rules](https://github.com/juanjimpad/claude-rules) — the rules repository

## Support

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/juanjimpad)
