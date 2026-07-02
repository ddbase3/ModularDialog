import { createStandardDialog } from '../../src/index.js';

const content = document.querySelector('#content');
content.hidden = false;

const dialog = createStandardDialog({
	title: 'Async action',
	content,
	status: 'Waiting.',
	buttons: [
		{
			key: 'close',
			label: 'Close',
			action: 'close'
		},
		{
			key: 'save',
			label: 'Save async',
			primary: true,
			busyLabel: 'Working...',
			async action(dialog) {
				await dialog.execute('runAsyncAction', {
					loadingStatus: 'Saving record...',
					successStatus: 'Record saved.',
					action: () => new Promise((resolve) => window.setTimeout(resolve, 900))
				});
			}
		}
	]
});

dialog.init();
document.querySelector('#openDialog').addEventListener('click', () => dialog.open());
