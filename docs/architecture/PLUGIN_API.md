# Plugin API

A plugin is an object returned by a factory function.

```javascript
export function ExamplePlugin(options = {}) {
	return {
		name: 'example',

		install(context) {
			context.registerSlot('toolbar.top');
		},

		commands: {
			exampleCommand(context, payload) {
				return payload;
			}
		},

		slotContributions(context) {
			return [
				{
					slot: 'toolbar.top',
					order: 100,
					render() {
						return document.createTextNode('Plugin content');
					}
				}
			];
		},

		destroy(context) {}
	};
}
```

Context fields:

- `dialog`
- `store`
- `events`
- `commands`
- `slots`
- `getState()`
- `setState(patch)`
- `execute(commandName, payload)`
- `emit(eventName, payload, options)`
- `requestRender()`
- `getOptions()`
- `getPluginOptions(pluginName)`
- slot helpers such as `registerSlot`, `setSlot` and `renderSlot`

Plugins can also provide a layout renderer through `renderLayout(renderContext)`. Only one layout renderer is used; the installed renderer with the highest `layoutOrder` wins.
