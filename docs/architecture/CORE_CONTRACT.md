# Core contract

`ModularDialog` owns dialog mechanics, not a fixed visual layout.

Core responsibilities:

- Create root, backdrop and surface elements.
- Manage open, close, toggle, render and destroy lifecycle.
- Dispatch lifecycle events.
- Provide commands.
- Provide state.
- Provide a slot registry.
- Install plugins.
- Apply basic ARIA attributes.
- Cooperate with the stack manager.

Main public methods:

- `init()`
- `open(detail)`
- `close(detail)`
- `toggle(detail)`
- `destroy()`
- `on(eventName, handler)`
- `once(eventName, handler)`
- `off(eventName, handler)`
- `emit(eventName, payload, options)`
- `execute(commandName, payload)`
- `registerSlot(slotName, options)`
- `setSlot(slotName, content, options)`
- `appendToSlot(slotName, content, options)`
- `prependToSlot(slotName, content, options)`
- `clearSlot(slotName)`
- `renderSlot(slotName, options)`

Cancelable lifecycle events:

- `beforeInit`
- `beforeOpen`
- `beforeClose`
- `beforeDestroy`

Common non-cancelable lifecycle events:

- `init`
- `open`
- `afterOpen`
- `close`
- `afterClose`
- `beforeRender`
- `render`
- `afterRender`
- `destroy`
