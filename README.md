<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1a0c8d73-7067-4ad2-90af-fa97973307d1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Worktree Boundary Checks

Use these checks before staging a feature PR:

```bash
npm run check:worktree
npm run check:worktree:strict
```

`npm run check:worktree` summarizes the should-commit / should-ignore / deferred / unknown split. `npm run check:worktree:strict` fails while unknown paths remain.

## Data And Generated Files

- SQLite runtime data belongs under `server/data/` and is ignored.
- Local screenshots and generated QA artifacts belong under `.codex-artifacts/` and are ignored.
- iOS build output and Capacitor generated files under `ios/` are ignored; iOS source files should be handled in a dedicated mobile PR.
