import { createStandardDialog } from '../../src/index.js';

const results = document.querySelector('#results');
const opener = document.querySelector('#opener');

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function report(message, passed = true) {
	const line = document.createElement('div');
	line.className = passed ? 'md-smoke-pass' : 'md-smoke-fail';
	line.textContent = `${passed ? 'PASS' : 'FAIL'}: ${message}`;
	results.appendChild(line);
}

try {
	const content = document.createElement('div');
	content.innerHTML = '<label>Name <input id="smokeInput" value="demo"></label>';
	let opened = false;
	let closed = false;
	let buttonClicked = false;
	const dialog = createStandardDialog({
		title: 'Smoke dialog',
		content,
		status: 'Ready.',
		buttons: [
			{
				key: 'ok',
				label: 'OK',
				primary: true,
				action(dialog) {
					buttonClicked = true;
					dialog.close({ source: 'button' });
				}
			}
		],
		onOpen() {
			opened = true;
		},
		onClose() {
			closed = true;
		}
	});

	dialog.init();
	opener.focus();
	dialog.open({ source: 'smoke' });
	assert(opened, 'Open callback should run.');
	assert(!dialog.getRootElement().hidden, 'Dialog root should be visible.');
	assert(dialog.getSurfaceElement().querySelector('.md-title').textContent === 'Smoke dialog', 'Title should render.');
	assert(dialog.getSurfaceElement().querySelector('#smokeInput'), 'Content should render.');
	report('standard dialog opens and renders slots');

	dialog.execute('setStatus', { message: 'Saved.', type: 'ok' });
	assert(dialog.getSurfaceElement().querySelector('.md-status-ok').textContent === 'Saved.', 'Status should update.');
	report('status command updates footer slot');

	dialog.getSurfaceElement().querySelector('[data-md-button="ok"]').click();
	assert(buttonClicked, 'Button action should run.');
	assert(closed, 'Close callback should run.');
	assert(dialog.getRootElement().hidden, 'Dialog should close.');
	report('button action closes dialog');

	dialog.open({ source: 'prevent-test' });
	const dispose = dialog.on('beforeClose', (event) => event.preventDefault());
	dialog.close({ source: 'manual' });
	assert(dialog.getState().open, 'beforeClose should be cancelable.');
	dispose();
	dialog.close({ source: 'manual' });
	report('beforeClose can prevent closing');

	dialog.open({ source: 'keyboard-test' });
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	assert(!dialog.getState().open, 'Escape should close dialog.');
	report('Escape closes top dialog');

	dialog.open({ source: 'backdrop-test' });
	dialog.getBackdropElement().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	assert(!dialog.getState().open, 'Backdrop click should close dialog.');
	report('backdrop click closes dialog');

	let asyncResolved = false;
	const asyncDialog = createStandardDialog({
		title: 'Async smoke',
		content: 'Async content',
		buttons: [
			{
				key: 'async',
				label: 'Run',
				primary: true,
				busyLabel: 'Running...',
				async action() {
					await new Promise((resolve) => window.setTimeout(resolve, 20));
					asyncResolved = true;
				}
			}
		]
	});
	asyncDialog.init().open();
	asyncDialog.getSurfaceElement().querySelector('[data-md-button="async"]').click();
	await new Promise((resolve) => window.setTimeout(resolve, 40));
	assert(asyncResolved, 'Async button should resolve.');
	report('async button action resolves');
	asyncDialog.destroy();

	dialog.destroy();
} catch (error) {
	report(error.message, false);
	throw error;
}
