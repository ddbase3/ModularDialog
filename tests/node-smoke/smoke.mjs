import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
	DialogCommandRegistry,
	DialogEventBus,
	DialogPluginManager,
	DialogSlotRegistry,
	DialogStateStore
} from '../../src/index.js';

const events = new DialogEventBus();
let seenEvent = false;
events.on('beforeClose', (event) => {
	seenEvent = true;
	event.preventDefault();
});
const closeEvent = events.emit('beforeClose', { source: 'test' }, { cancelable: true });
assert.equal(seenEvent, true);
assert.equal(closeEvent.defaultPrevented, true);
assert.equal(closeEvent.detail.source, 'test');

let onceCount = 0;
events.once('open', () => {
	onceCount += 1;
});
events.emit('open');
events.emit('open');
assert.equal(onceCount, 1);

const commands = new DialogCommandRegistry();
commands.register('ping', (payload) => `${payload}:pong`);
assert.equal(commands.has('ping'), true);
assert.equal(commands.execute('ping', 'test'), 'test:pong');

const store = new DialogStateStore({ open: false });
let observedOpen = null;
store.subscribe((state) => {
	observedOpen = state.open;
});
store.setState({ open: true });
assert.equal(store.getState().open, true);
assert.equal(observedOpen, true);

const slots = new DialogSlotRegistry();
slots.register('main');
slots.append('main', 'late', { order: 20 });
slots.prepend('main', 'early');
assert.deepEqual(slots.names(), ['main']);
assert.equal(slots.getEntries('main')[0].content, 'early');
assert.equal(slots.getEntries('main')[1].content, 'late');

const pluginCommands = new DialogCommandRegistry();
const pluginContext = {
	commands: pluginCommands,
	getState: () => ({}),
	setState: () => {},
	requestRender: () => {}
};
const manager = new DialogPluginManager(pluginContext);
manager.install([
	{
		name: 'testPlugin',
		commands: {
			echo(context, payload) {
				return payload;
			}
		},
		slotContributions() {
			return [
				{
					slot: 'main',
					order: 5,
					content: 'plugin'
				}
			];
		}
	}
]);
assert.equal(pluginCommands.execute('echo', 'ok'), 'ok');
assert.equal(manager.getSlotContributions('main').length, 1);
assert.equal(manager.getSlotContributions('main')[0].source, 'testPlugin');
manager.destroy();

const css = readFileSync(new URL('../../src/styles/modulardialog.css', import.meta.url), 'utf8');
const closeButtonRule = css.match(/\.md-close-button\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';
assert.equal(closeButtonRule.includes('font-size'), false);
assert.equal(closeButtonRule.includes('width:'), false);
assert.equal(css.includes('--md-button-font-size'), true);
assert.equal(css.includes('font-size: var(--md-button-font-size);'), true);

console.log('ModularDialog node smoke passed.');
