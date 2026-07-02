import { createStandardDialog } from '../../src/index.js';

const openButton = document.querySelector('#openDialog');
const form = document.querySelector('#demoForm');
form.hidden = false;

const dialog = createStandardDialog({
	title: 'Preset editor',
	content: form,
	status: 'Ready.',
	buttons: [
		{
			key: 'cancel',
			label: 'Cancel',
			action: 'close'
		},
		{
			key: 'save',
			label: 'Save',
			primary: true,
			busyLabel: 'Saving...',
			async action(dialog) {
				dialog.execute('setStatus', { message: 'Saving...', type: 'loading' });
				await new Promise((resolve) => window.setTimeout(resolve, 500));
				dialog.execute('setStatus', { message: 'Saved.', type: 'ok' });
			}
		}
	]
});

dialog.init();
openButton.addEventListener('click', () => dialog.open({ source: 'demo' }));
