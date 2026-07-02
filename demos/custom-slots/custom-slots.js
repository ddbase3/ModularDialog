import { ButtonBarPlugin, CloseButtonPlugin, DialogShellPlugin, ModularDialog, StatusPlugin, TitlePlugin } from '../../src/index.js';

function ToolbarPlugin() {
	return {
		name: 'toolbar',

		install(context) {
			context.registerSlot('body.before', { hiddenWhenEmpty: true });
		},

		slotContributions() {
			return [
				{
					slot: 'body.before',
					order: 10,
					render() {
						const toolbar = document.createElement('div');
						toolbar.className = 'demo-toolbar';
						toolbar.textContent = 'This toolbar is provided by a plugin through the body.before slot.';
						return toolbar;
					}
				}
			];
		}
	};
}

const dialog = new ModularDialog({
	title: 'Custom slot dialog',
	content: 'The dialog shell is composed from slots, not hardcoded header/footer logic.',
	status: 'Slot model active.',
	plugins: [
		DialogShellPlugin(),
		TitlePlugin(),
		CloseButtonPlugin(),
		StatusPlugin(),
		ButtonBarPlugin({
			buttons: [
				{ key: 'close', label: 'Close', action: 'close', primary: true }
			]
		}),
		ToolbarPlugin()
	]
});

dialog.init();
document.querySelector('#openDialog').addEventListener('click', () => dialog.open());
