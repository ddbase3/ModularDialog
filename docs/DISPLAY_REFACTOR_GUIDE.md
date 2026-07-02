# Display refactor guide

The inspected display currently implements modal behavior directly in the template:

- modal/backdrop markup
- header with title and close button
- body form
- footer status and action buttons
- `.is-open` toggling
- `aria-hidden` toggling
- close button binding
- backdrop click binding
- status text/type handling

With ModularDialog, the display keeps only display-specific form and data logic. Dialog mechanics move to the module.

## Before

The display owns logic similar to:

```javascript
function openPresetEditor(record) {
	// populate form
	modal.classList.add('is-open');
	modal.setAttribute('aria-hidden', 'false');
	setEditorStatus('Ready.', 'ok');
}

function closePresetEditor() {
	modal.classList.remove('is-open');
	modal.setAttribute('aria-hidden', 'true');
}
```

## After

The display initializes a reusable dialog:

```javascript
import { createStandardDialog } from './ModularDialog/src/index.js';
import './ModularDialog/src/styles/modulardialog.css';

const editorDialog = createStandardDialog({
	title: 'Preset editor',
	content: document.querySelector('#agent-component-preset-step5-form'),
	status: 'Ready.',
	buttons: [
		{
			key: 'copy',
			label: 'Copy payload',
			action() {
				copyEditorPayload();
			}
		},
		{
			key: 'save',
			label: 'Save preset',
			primary: true,
			busyLabel: 'Saving...',
			async action() {
				await saveEditorPayload();
			}
		}
	]
});

editorDialog.init();

function openPresetEditor(record) {
	// populate form and controls
	editorDialog.execute('setStatus', { message: 'Ready.', type: 'ok' });
	editorDialog.open({ source: 'presetEditor', record });
}

function closePresetEditor() {
	editorDialog.close({ source: 'display' });
}
```

## Mapping

| Old display responsibility | New location |
| --- | --- |
| modal open/close classes | `ModularDialog` core |
| Escape key | `KeyboardPlugin` |
| backdrop close | `BackdropPlugin` |
| focus handling | `FocusTrapPlugin` |
| title | `TitlePlugin` |
| close button | `CloseButtonPlugin` |
| status area | `StatusPlugin` |
| action buttons | `ButtonBarPlugin` |
| async loading state | `ButtonBarPlugin` and `AsyncActionPlugin` |
| dirty form guard | optional `DirtyGuardPlugin` |

## Recommended migration order

1. Move existing form markup out of modal wrapper and keep it as content.
2. Include `modulardialog.css` and `src/index.js`.
3. Replace local open/close helpers with `editorDialog.open()` and `editorDialog.close()`.
4. Replace local status helpers with `editorDialog.execute('setStatus', ...)`.
5. Move footer buttons into the `buttons` option.
6. Remove template-owned modal wrapper CSS once no longer referenced.
