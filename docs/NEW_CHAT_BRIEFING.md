# New chat briefing

The requested package is named `ModularDialog`.

Architectural decision: the basis is a flexible slot/zone core. The common modal layout with headline, close button, status area and action buttons is implemented by `DialogShellPlugin` plus small slot-contribution plugins. It is also exposed through `createStandardDialog()` for simple display refactors.

The package follows the ChronoPicker style: ES modules, `src/core`, `src/plugins`, demos, docs and smoke tests.

Before changing behavior, run:

```bash
npm run smoke
```

Manual browser smoke:

```bash
python3 -m http.server 8000
```

Then open `tests/browser-smoke/`.
