# ModularDialog

ModularDialog is a slot-based Vanilla JavaScript dialog module.

The core is intentionally not a fixed header/body/footer modal. It provides dialog mechanics, lifecycle events, commands, state and a slot registry. Concrete layouts are implemented by plugins. The included standard shell plugin maps the common layout to slots:

- `header.start` for a headline or tools
- `header.end` for the close button or other tools
- `main` for the content area
- `footer.start` for status information
- `footer.end` for action buttons

This keeps simple display refactors small while leaving room for future custom shells, sidebars, wizards and toolbars.

## Current scope

This package includes:

- `ModularDialog` core
- cancelable lifecycle events
- command registry
- event bus
- state store
- slot registry
- plugin manager
- stack manager with z-index handling and body scroll lock
- standard shell plugin
- title plugin
- close button plugin
- status plugin
- button bar plugin with async action support
- keyboard plugin
- backdrop plugin
- focus trap plugin
- dirty guard plugin
- draggable plugin
- resizable plugin
- async action plugin
- CSS with custom properties
- demos
- node smoke test
- browser smoke test
- architecture and integration documentation

## Project structure

- `src/` core source, plugins, utilities and styles
- `demos/` manual browser demos
- `tests/` smoke coverage
- `docs/` continuation and architecture documentation

## How to run

Use any static web server from the project root.

```bash
python3 -m http.server 8000
```

Then open for example:

- `http://localhost:8000/demos/basic/`
- `http://localhost:8000/demos/async-actions/`
- `http://localhost:8000/demos/custom-slots/`
- `http://localhost:8000/tests/browser-smoke/`

## Node smoke test

```bash
npm run smoke
```

The node smoke test covers the non-DOM core building blocks. Browser rendering and interaction are covered by `tests/browser-smoke/`.

## Basic standard-dialog usage

```javascript
import { createStandardDialog } from './src/index.js';
import './src/styles/modulardialog.css';

const dialog = createStandardDialog({
	title: 'Preset editor',
	content: document.querySelector('#editorForm'),
	status: 'Save is enabled.',
	buttons: [
		{
			key: 'copy',
			label: 'Copy payload',
			action(dialog) {
				copyEditorPayload();
			}
		},
		{
			key: 'save',
			label: 'Save',
			primary: true,
			busyLabel: 'Saving...',
			async action(dialog) {
				await saveEditorPayload();
			}
		}
	],
	onOpen() {
		console.log('Dialog opened.');
	},
	onClose() {
		console.log('Dialog closed.');
	}
});

dialog.init();
dialog.open();
```

## Slot-first usage

```javascript
import { ModularDialog, DialogShellPlugin } from './src/index.js';

const dialog = new ModularDialog({
	plugins: [
		DialogShellPlugin()
	],
	slots: {
		'header.start': 'Custom headline',
		main: document.querySelector('#editorForm'),
		'footer.start': 'Ready'
	}
});

dialog.init().open();
```

## Cancelable close event

```javascript
dialog.on('beforeClose', (event) => {
	if (formIsDirty()) {
		event.preventDefault();
		dialog.execute('setStatus', {
			message: 'Please save or discard your changes first.',
			type: 'warning'
		});
	}
});
```

## Documentation

For continuation across chats, start with:

- `docs/README.md`
- `docs/CURRENT_STATUS.md`
- `docs/WORKING_RULES.md`
- `docs/NEW_CHAT_BRIEFING.md`
- `docs/architecture/CORE_CONTRACT.md`
- `docs/architecture/PLUGIN_API.md`
- `docs/architecture/SLOT_MODEL.md`
- `docs/DISPLAY_REFACTOR_GUIDE.md`
- `docs/todo/FEATURE_TODO.md`

## Important design rule

ModularDialog must remain a reusable dialog and slot module.

Displays may use ModularDialog, but ModularDialog must not depend on display-specific markup, ModularGrid internals or MissionBay-specific PHP templates.
