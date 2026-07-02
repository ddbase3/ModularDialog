let internalId = 0;

export class DialogEvent {
	constructor(type, options = {}) {
		this.type = type;
		this.name = type;
		this.dialog = options.dialog || null;
		this.detail = options.detail || {};
		this.cancelable = Boolean(options.cancelable);
		this.defaultPrevented = false;
		this.timeStamp = Date.now();
		this.timestamp = this.timeStamp;
	}

	preventDefault() {
		if (this.cancelable) {
			this.defaultPrevented = true;
		}
	}
}

export class DialogEventBus {
	constructor() {
		this.listeners = new Map();
	}

	on(eventName, handler) {
		if (!eventName || typeof handler !== 'function') {
			throw new Error('ModularDialog event registration requires an event name and handler.');
		}

		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, new Set());
		}

		this.listeners.get(eventName).add(handler);

		return () => this.off(eventName, handler);
	}

	once(eventName, handler) {
		const dispose = this.on(eventName, (event) => {
			dispose();
			return handler(event);
		});

		return dispose;
	}

	off(eventName, handler) {
		const handlers = this.listeners.get(eventName);

		if (!handlers) {
			return;
		}

		handlers.delete(handler);

		if (handlers.size === 0) {
			this.listeners.delete(eventName);
		}
	}

	emit(eventName, payload = {}, options = {}) {
		const event = payload instanceof DialogEvent
			? payload
			: new DialogEvent(eventName, {
				dialog: options.dialog,
				detail: payload,
				cancelable: options.cancelable
			});
		const handlers = this.listeners.get(eventName);

		if (!handlers) {
			return event;
		}

		for (const handler of Array.from(handlers)) {
			const result = handler(event);

			if (result === false) {
				event.preventDefault();
			}
		}

		return event;
	}

	clear() {
		this.listeners.clear();
	}
}

export class DialogCommandRegistry {
	constructor() {
		this.commands = new Map();
	}

	register(name, handler, options = {}) {
		if (!name || typeof handler !== 'function') {
			throw new Error('ModularDialog command registration requires a name and handler.');
		}

		if (this.commands.has(name) && !options.replace) {
			throw new Error(`ModularDialog command already registered: ${name}`);
		}

		this.commands.set(name, handler);

		return () => this.unregister(name, handler);
	}

	replace(name, handler) {
		return this.register(name, handler, { replace: true });
	}

	unregister(name, handler = null) {
		if (!this.commands.has(name)) {
			return;
		}

		if (handler && this.commands.get(name) !== handler) {
			return;
		}

		this.commands.delete(name);
	}

	has(name) {
		return this.commands.has(name);
	}

	names() {
		return Array.from(this.commands.keys());
	}

	execute(name, payload) {
		const handler = this.commands.get(name);

		if (!handler) {
			throw new Error(`ModularDialog command not registered: ${name}`);
		}

		return handler(payload);
	}

	clear() {
		this.commands.clear();
	}
}

export class DialogStateStore {
	constructor(initialState = {}) {
		this.state = { ...initialState };
		this.listeners = new Set();
	}

	getState() {
		return this.state;
	}

	setState(patch = {}) {
		this.state = {
			...this.state,
			...patch
		};

		for (const listener of Array.from(this.listeners)) {
			listener(this.state);
		}
	}

	update(updater) {
		this.setState(updater(this.state));
	}

	subscribe(listener) {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}
}

export class DialogSlotRegistry {
	constructor() {
		this.definitions = new Map();
		this.contents = new Map();
	}

	register(name, options = {}) {
		if (!name) {
			throw new Error('ModularDialog slot registration requires a name.');
		}

		const current = this.definitions.get(name) || {};
		this.definitions.set(name, {
			name,
			tagName: options.tagName || current.tagName || 'div',
			className: options.className || current.className || '',
			hiddenWhenEmpty: options.hiddenWhenEmpty ?? current.hiddenWhenEmpty ?? false,
			attrs: {
				...(current.attrs || {}),
				...(options.attrs || {})
			}
		});

		if (!this.contents.has(name)) {
			this.contents.set(name, []);
		}

		return this;
	}

	names() {
		return Array.from(this.definitions.keys());
	}

	set(name, content, options = {}) {
		this.clear(name);

		if (content !== undefined && content !== null) {
			this.append(name, content, options);
		}

		return this;
	}

	append(name, content, options = {}) {
		this.register(name);

		if (Array.isArray(content) && !options.keepArray) {
			content.forEach((item, index) => this.append(name, item, {
				...options,
				order: (options.order || 0) + index
			}));
			return this;
		}

		this.contents.get(name).push({
			key: options.key || uniqueId('slot-entry'),
			order: options.order || 0,
			content,
			render: options.render,
			html: Boolean(options.html),
			source: options.source || 'instance'
		});

		return this;
	}

	prepend(name, content, options = {}) {
		return this.append(name, content, {
			...options,
			order: options.order ?? -1000
		});
	}

	clear(name) {
		this.contents.set(name, []);

		return this;
	}

	getEntries(name) {
		return [...(this.contents.get(name) || [])].sort(sortEntries);
	}

	render(name, context = {}, contributions = [], options = {}) {
		if (!this.definitions.has(name)) {
			this.register(name);
		}

		const definition = this.definitions.get(name);
		const element = createElement(options.tagName || definition.tagName, {
			className: ['md-slot', slotNameClass(name), definition.className, options.className],
			attrs: {
				'data-md-slot': name,
				...(definition.attrs || {}),
				...(options.attrs || {})
			}
		});
		const entries = this.getEntries(name).concat(normalizeContributions(contributions)).sort(sortEntries);

		for (const entry of entries) {
			const content = typeof entry.render === 'function'
				? entry.render(context)
				: (typeof entry.content === 'function' ? entry.content(context) : entry.content);
			appendContent(element, content, { html: entry.html });
		}

		const hiddenWhenEmpty = options.hiddenWhenEmpty ?? definition.hiddenWhenEmpty;

		if (hiddenWhenEmpty && element.childNodes.length === 0) {
			return null;
		}

		return element;
	}
}

export class DialogPluginManager {
	constructor(context) {
		this.context = context;
		this.plugins = [];
		this.cleanups = [];
	}

	install(plugins = []) {
		for (const pluginDefinition of plugins) {
			const plugin = typeof pluginDefinition === 'function'
				? pluginDefinition(this.context)
				: pluginDefinition;

			if (!plugin || !plugin.name) {
				throw new Error('ModularDialog plugins require a unique name.');
			}

			if (this.plugins.some((installedPlugin) => installedPlugin.name === plugin.name)) {
				throw new Error(`ModularDialog plugin already installed: ${plugin.name}`);
			}

			if (plugin.commands) {
				for (const [commandName, handler] of Object.entries(plugin.commands)) {
					const commandHandler = (payload) => handler(this.context, payload);
					const cleanup = this.context.commands.register(commandName, commandHandler);

					if (typeof cleanup === 'function') {
						this.cleanups.push(cleanup);
					}
				}
			}

			if (typeof plugin.install === 'function') {
				const cleanup = plugin.install(this.context);

				if (typeof cleanup === 'function') {
					this.cleanups.push(cleanup);
				}
			}

			this.plugins.push(plugin);
		}
	}

	getSlotContributions(slotName) {
		const contributions = [];

		for (const plugin of this.plugins) {
			for (const contribution of getPluginContributions(plugin, this.context)) {
				if ((contribution.slot || contribution.zone) === slotName) {
					contributions.push({ ...contribution, source: plugin.name });
				}
			}
		}

		return contributions.sort((left, right) => (left.order || 0) - (right.order || 0));
	}

	getLayoutRenderer() {
		const layouts = this.plugins
			.filter((plugin) => typeof plugin.renderLayout === 'function')
			.map((plugin) => ({ plugin, order: plugin.layoutOrder || 0 }))
			.sort((left, right) => left.order - right.order);

		return layouts.length > 0 ? layouts[layouts.length - 1].plugin.renderLayout.bind(layouts[layouts.length - 1].plugin) : null;
	}

	destroy() {
		for (const plugin of [...this.plugins].reverse()) {
			if (typeof plugin.destroy === 'function') {
				plugin.destroy(this.context);
			}
		}

		for (const cleanup of [...this.cleanups].reverse()) {
			cleanup();
		}

		this.cleanups = [];
		this.plugins = [];
	}
}

export class DialogStackManager {
	constructor() {
		this.stack = [];
		this.lockCount = 0;
		this.savedOverflow = '';
	}

	open(dialog) {
		this.remove(dialog);
		this.stack.push(dialog);
		const root = dialog.getRootElement();

		if (root) {
			root.style.zIndex = String((dialog.options.zIndexBase || 9000) + this.stack.length * 2);
		}

		if (dialog.options.modal) {
			this.lockScroll();
		}
	}

	close(dialog) {
		const existed = this.remove(dialog);

		if (existed && dialog.options.modal) {
			this.unlockScroll();
		}
	}

	isTop(dialog) {
		return this.stack[this.stack.length - 1] === dialog;
	}

	remove(dialog) {
		const length = this.stack.length;
		this.stack = this.stack.filter((item) => item !== dialog);

		return length !== this.stack.length;
	}

	lockScroll() {
		if (typeof document === 'undefined' || !document.body) {
			return;
		}

		if (this.lockCount === 0) {
			this.savedOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			document.body.classList.add('md-scroll-lock', 'md-scroll-locked');
		}

		this.lockCount += 1;
	}

	unlockScroll() {
		if (typeof document === 'undefined' || !document.body) {
			return;
		}

		this.lockCount = Math.max(0, this.lockCount - 1);

		if (this.lockCount === 0) {
			document.body.style.overflow = this.savedOverflow;
			document.body.classList.remove('md-scroll-lock', 'md-scroll-locked');
		}
	}
}

export const globalDialogStack = new DialogStackManager();

export class ModularDialog {
	constructor(target, options = {}) {
		if (isPlainObject(target) && Object.keys(options).length === 0) {
			options = target;
			target = options.target || null;
		}

		this.target = target || null;
		this.options = normalizeDialogOptions(options);
		this.id = this.options.id;
		this.events = new DialogEventBus();
		this.store = new DialogStateStore({ open: false, busy: false, destroyed: false });
		this.commands = new DialogCommandRegistry();
		this.slots = new DialogSlotRegistry();
		this.stack = this.options.stackManager || globalDialogStack;
		this.root = null;
		this.backdrop = null;
		this.surface = null;
		this.initialized = false;
		this.destroyed = false;
		this.pluginManager = new DialogPluginManager(this.createPluginContext());
	}

	createPluginContext() {
		return {
			dialog: this,
			store: this.store,
			events: this.events,
			commands: this.commands,
			slots: this.slots,
			getState: () => this.getState(),
			setState: (patch) => this.setState(patch),
			execute: (commandName, payload) => this.execute(commandName, payload),
			emit: (eventName, payload, options) => this.emit(eventName, payload, options),
			requestRender: () => this.requestRender(),
			getOptions: () => this.options,
			getPluginOptions: (pluginName) => this.options.pluginOptions?.[pluginName] || {},
			registerSlot: (name, options) => this.registerSlot(name, options),
			setSlot: (name, content, options) => this.setSlot(name, content, options),
			appendToSlot: (name, content, options) => this.appendToSlot(name, content, options),
			prependToSlot: (name, content, options) => this.prependToSlot(name, content, options),
			clearSlot: (name) => this.clearSlot(name),
			renderSlot: (name, options) => this.renderSlot(name, options)
		};
	}

	init() {
		if (this.initialized) {
			return this;
		}

		if (this.destroyed) {
			throw new Error('ModularDialog instance was destroyed and cannot be initialized again.');
		}

		const beforeInit = this.emitLifecycle('beforeInit', {}, true);

		if (beforeInit.defaultPrevented) {
			return this;
		}

		this.registerCoreCommands();
		for (const slotName of this.options.defaultSlots) {
			this.registerSlot(slotName, { render: false });
		}
		this.createRoot();
		this.applyInitialSlots();
		this.pluginManager.install(this.getPluginDefinitions());
		this.initialized = true;
		this.render();
		this.emitLifecycle('init');

		if (this.options.autoOpen) {
			this.open({ source: 'autoOpen' });
		}

		return this;
	}

	registerCoreCommands() {
		this.commands.register('open', (payload) => this.open(payload));
		this.commands.register('close', (payload) => this.close(payload));
		this.commands.register('toggle', (payload) => this.getState().open ? this.close(payload) : this.open(payload));
		this.commands.register('destroy', () => this.destroy());
		this.commands.register('render', () => this.requestRender());
		this.commands.register('registerSlot', (payload) => this.registerSlot(payload.slot || payload.name || payload, payload.options || {}));
		this.commands.register('focus', (payload) => this.focus(payload));
		this.commands.register('setBusy', (payload) => {
			const busy = payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'busy') ? Boolean(payload.busy) : Boolean(payload);
			this.setState({ busy });
			this.requestRender();
		});
		this.commands.register('setContent', (payload) => this.setSlot('main', payload && payload.content !== undefined ? payload.content : payload));
		this.commands.register('setSlot', (payload) => this.setSlot(payload.slot || payload.name, payload.content, payload.options || {}));
		this.commands.register('appendToSlot', (payload) => this.appendToSlot(payload.slot || payload.name, payload.content, payload.options || {}));
		this.commands.register('prependToSlot', (payload) => this.prependToSlot(payload.slot || payload.name, payload.content, payload.options || {}));
		this.commands.register('clearSlot', (payload) => this.clearSlot(payload.slot || payload.name || payload));
	}

	createRoot() {
		const appendTo = resolveContainer(this.options.appendTo || this.target || document.body);
		this.root = createElement('div', {
			className: this.buildRootClassName(),
			attrs: { id: this.id, hidden: 'hidden', 'aria-hidden': 'true', 'data-modular-dialog': 'root' }
		});
		this.backdrop = createElement('div', { className: 'md-backdrop', attrs: { 'data-modular-dialog': 'backdrop' } });
		this.surface = createElement('div', { className: this.buildSurfaceClassName(), attrs: { 'data-modular-dialog': 'surface' } });
		this.backdrop.appendChild(this.surface);
		this.root.appendChild(this.backdrop);
		appendTo.appendChild(this.root);
		this.applySurfaceOptions();
	}

	applyInitialSlots() {
		if (this.options.content !== null && this.options.content !== undefined) {
			this.setSlot('main', this.options.content, { render: false });
		}

		for (const [slotName, content] of Object.entries(this.options.slots || {})) {
			this.setSlot(slotName, content, { render: false });
		}
	}

	getPluginDefinitions() {
		const plugins = [...(this.options.plugins || [])];

		if (this.options.defaultPlugins !== false) {
			plugins.push(BackdropPlugin(), KeyboardPlugin(), FocusTrapPlugin());
		}

		return plugins;
	}

	open(detail = {}) {
		if (!this.initialized) {
			this.init();
		}

		if (this.getState().open) {
			return this;
		}

		const beforeOpen = this.emitLifecycle('beforeOpen', detail, true);

		if (beforeOpen.defaultPrevented) {
			return this;
		}

		this.setState({ open: true, lastOpenDetail: detail, closeReason: '' });
		this.stack.open(this);
		this.requestRender();
		this.emitLifecycle('open', detail);
		this.emitLifecycle('afterOpen', detail);

		return this;
	}

	toggle(detail = {}) {
		return this.getState().open ? this.close(detail) : this.open(detail);
	}

	close(detail = {}) {
		if (!this.initialized || !this.getState().open) {
			return this;
		}

		const beforeClose = this.emitLifecycle('beforeClose', detail, true);

		if (beforeClose.defaultPrevented) {
			return this;
		}

		this.setState({ open: false, lastCloseDetail: detail, closeReason: detail?.reason || detail?.source || '' });
		this.stack.close(this);
		this.requestRender();
		this.emitLifecycle('close', detail);
		this.emitLifecycle('afterClose', detail);

		return this;
	}

	focus(payload = {}) {
		const target = payload && typeof payload === 'object' ? payload.target : payload;
		const element = typeof target === 'string' ? this.surface.querySelector(target) : target;
		focusElement(element || this.surface);

		return this;
	}

	destroy() {
		if (this.destroyed) {
			return;
		}

		const beforeDestroy = this.emitLifecycle('beforeDestroy', {}, true);

		if (beforeDestroy.defaultPrevented) {
			return;
		}

		if (this.getState().open) {
			this.stack.close(this);
		}

		this.pluginManager.destroy();
		this.initialized = false;
		this.destroyed = true;
		this.setState({ destroyed: true, open: false });
		this.emitLifecycle('destroy');

		if (this.root && this.root.parentNode) {
			this.root.parentNode.removeChild(this.root);
		}

		this.root = null;
		this.backdrop = null;
		this.surface = null;
		this.commands.clear();
		this.events.clear();
	}

	render() {
		if (!this.root || !this.surface) {
			return;
		}

		this.emitLifecycle('beforeRender');
		this.root.className = this.buildRootClassName();
		this.surface.className = this.buildSurfaceClassName();
		this.root.hidden = !this.getState().open;
		setAttributes(this.root, { 'aria-hidden': this.getState().open ? 'false' : 'true' });
		this.applySurfaceOptions();
		clearElement(this.surface);

		const layoutRenderer = this.pluginManager.getLayoutRenderer();
		const layout = layoutRenderer ? layoutRenderer(this.createRenderContext()) : this.renderDefaultLayout();

		if (layout) {
			this.surface.appendChild(layout);
		}

		this.emitLifecycle('render');
		this.emitLifecycle('afterRender');
	}

	renderDefaultLayout() {
		const fragment = document.createDocumentFragment();

		for (const slotName of this.slots.names()) {
			const slot = this.renderSlot(slotName, { hiddenWhenEmpty: true });

			if (slot) {
				fragment.appendChild(slot);
			}
		}

		return fragment;
	}

	createRenderContext() {
		return {
			dialog: this,
			state: this.getState(),
			options: this.options,
			getState: () => this.getState(),
			getOptions: () => this.options,
			renderSlot: (name, options) => this.renderSlot(name, options),
			execute: (commandName, payload) => this.execute(commandName, payload),
			emit: (eventName, payload, options) => this.emit(eventName, payload, options)
		};
	}

	renderSlot(name, options = {}) {
		return this.slots.render(name, this.createRenderContext(), this.pluginManager.getSlotContributions(name), options);
	}

	requestRender() {
		if (this.initialized) {
			this.render();
		}
	}

	registerSlot(name, options = {}) {
		this.slots.register(name, options);

		if (options.render !== false) {
			this.requestRender();
		}

		return this;
	}

	setSlot(name, content, options = {}) {
		this.slots.set(name, content, options);

		if (options.render !== false) {
			this.requestRender();
		}

		this.emit('slotChange', { slot: name, type: 'set' });

		return this;
	}

	appendToSlot(name, content, options = {}) {
		this.slots.append(name, content, options);

		if (options.render !== false) {
			this.requestRender();
		}

		this.emit('slotChange', { slot: name, type: 'append' });

		return this;
	}

	prependToSlot(name, content, options = {}) {
		this.slots.prepend(name, content, options);

		if (options.render !== false) {
			this.requestRender();
		}

		this.emit('slotChange', { slot: name, type: 'prepend' });

		return this;
	}

	clearSlot(name) {
		this.slots.clear(name);
		this.requestRender();
		this.emit('slotChange', { slot: name, type: 'clear' });

		return this;
	}

	on(eventName, handler) {
		return this.events.on(eventName, handler);
	}

	once(eventName, handler) {
		return this.events.once(eventName, handler);
	}

	off(eventName, handler) {
		this.events.off(eventName, handler);
	}

	emit(eventName, payload = {}, options = {}) {
		return this.events.emit(eventName, payload, { dialog: this, ...options });
	}

	emitLifecycle(eventName, detail = {}, cancelable = false) {
		const event = this.emit(eventName, detail, { cancelable });
		const callback = this.options[`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`];

		if (typeof callback === 'function') {
			const result = callback(event);

			if (result === false) {
				event.preventDefault();
			}
		}

		return event;
	}

	getState() {
		return this.store.getState();
	}

	setState(patch) {
		this.store.setState(patch);
	}

	execute(commandName, payload) {
		return this.commands.execute(commandName, payload);
	}

	getRootElement() {
		return this.root;
	}

	getBackdropElement() {
		return this.backdrop;
	}

	getSurfaceElement() {
		return this.surface;
	}

	isTop() {
		return this.stack.isTop(this);
	}

	setAriaLabelledBy(id) {
		this.options.ariaLabelledBy = id;
		this.applySurfaceOptions();
	}

	setAriaDescribedBy(id) {
		this.options.ariaDescribedBy = id;
		this.applySurfaceOptions();
	}

	applySurfaceOptions() {
		if (!this.surface) {
			return;
		}

		setAttributes(this.surface, {
			role: this.options.role,
			'aria-modal': this.options.modal ? 'true' : undefined,
			'aria-label': this.options.ariaLabel,
			'aria-labelledby': this.options.ariaLabelledBy,
			'aria-describedby': this.options.ariaDescribedBy,
			tabindex: '-1'
		});
		applyDimension(this.surface, 'width', this.options.width);
		applyDimension(this.surface, 'height', this.options.height);
		applyDimension(this.surface, 'maxWidth', this.options.maxWidth);
		applyDimension(this.surface, 'maxHeight', this.options.maxHeight);
	}

	buildRootClassName() {
		return ['md-root', this.options.modal ? 'md-modal' : 'md-non-modal', this.getState().open ? 'md-open' : 'md-closed', this.options.className].filter(Boolean).join(' ');
	}

	buildSurfaceClassName() {
		return ['md-surface', `md-size-${this.options.size}`, this.getState().busy ? 'md-busy' : '', this.options.surfaceClassName].filter(Boolean).join(' ');
	}
}

export function createStandardDialog(target, options = {}) {
	if (isPlainObject(target) && Object.keys(options).length === 0) {
		options = target;
		target = options.target || null;
	}

	const plugins = [
		DialogShellPlugin(options.shell || {}),
		TitlePlugin(options.titlePlugin || {}),
		CloseButtonPlugin(options.closeButtonPlugin || {}),
		StatusPlugin(options.statusPlugin || {}),
		ButtonBarPlugin(options.buttonBarPlugin || {}),
		AsyncActionPlugin(options.asyncActionPlugin || {})
	];

	if (options.dirtyGuard) {
		plugins.push(DirtyGuardPlugin(options.dirtyGuard === true ? {} : options.dirtyGuard));
	}

	if (options.draggable) {
		plugins.push(DraggablePlugin(options.draggable === true ? {} : options.draggable));
	}

	if (options.resizable) {
		plugins.push(ResizablePlugin(options.resizable === true ? {} : options.resizable));
	}

	plugins.push(...(options.plugins || []));

	return new ModularDialog(target, {
		...options,
		plugins
	});
}

export function DialogShellPlugin(pluginOptions = {}) {
	let options = null;

	return {
		name: 'dialogShell',
		layoutOrder: pluginOptions.layoutOrder || 100,
		install(context) {
			options = {
				showHeader: true,
				showFooter: true,
				keepEmptyHeader: false,
				keepEmptyFooter: false,
				headerStartSlot: 'header.start',
				headerEndSlot: 'header.end',
				bodyBeforeSlot: 'body.before',
				bodySlot: 'main',
				bodyAfterSlot: 'body.after',
				footerStartSlot: 'footer.start',
				footerEndSlot: 'footer.end',
				className: '',
				...pluginOptions,
				...context.getPluginOptions('dialogShell')
			};
			for (const slotName of [options.headerStartSlot, options.headerEndSlot, options.bodyBeforeSlot, options.bodySlot, options.bodyAfterSlot, options.footerStartSlot, options.footerEndSlot]) {
				context.registerSlot(slotName, { hiddenWhenEmpty: slotName !== options.bodySlot, render: false });
			}
		},
		renderLayout(context) {
			const shell = createElement('div', { className: ['md-shell', options.className] });

			if (options.showHeader) {
				const header = createElement('div', {
					className: 'md-shell-header',
					attrs: {
						'data-md-dialog-header': '1',
						'data-md-drag-handle': context.getOptions().draggable ? '1' : undefined
					}
				});
				appendRendered(header, context.renderSlot(options.headerStartSlot, { hiddenWhenEmpty: true }));
				appendRendered(header, context.renderSlot(options.headerEndSlot, { hiddenWhenEmpty: true }));

				if (header.childNodes.length > 0 || options.keepEmptyHeader) {
					shell.appendChild(header);
				}
			}

			const body = createElement('div', { className: 'md-shell-body' });
			appendRendered(body, context.renderSlot(options.bodyBeforeSlot, { hiddenWhenEmpty: true }));
			appendRendered(body, context.renderSlot(options.bodySlot, { hiddenWhenEmpty: false }));
			appendRendered(body, context.renderSlot(options.bodyAfterSlot, { hiddenWhenEmpty: true }));
			shell.appendChild(body);

			if (options.showFooter) {
				const footer = createElement('div', { className: 'md-shell-footer' });
				appendRendered(footer, context.renderSlot(options.footerStartSlot, { hiddenWhenEmpty: true }));
				appendRendered(footer, context.renderSlot(options.footerEndSlot, { hiddenWhenEmpty: true }));

				if (footer.childNodes.length > 0 || options.keepEmptyFooter) {
					shell.appendChild(footer);
				}
			}

			return shell;
		}
	};
}

export function TitlePlugin(pluginOptions = {}) {
	let options = null;
	let titleId = '';

	return {
		name: 'title',
		install(context) {
			options = { slot: 'header.start', order: 10, tagName: 'div', className: '', ...pluginOptions, ...context.getPluginOptions('title') };
			titleId = options.id || `${context.dialog.id}-title`;
			context.setState({ title: options.title ?? context.getOptions().title ?? '' });
			context.dialog.setAriaLabelledBy(titleId);
			context.commands.register('setTitle', (payload) => {
				const title = payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'title') ? payload.title : payload;
				context.setState({ title: title == null ? '' : String(title) });
				context.requestRender();
			});
		},
		slotContributions() {
			return [{
				slot: options.slot,
				order: options.order,
				render({ state }) {
					if (!state.title && !options.renderEmpty) {
						return null;
					}

					return createElement(options.tagName, { className: ['md-title', options.className], text: state.title || '', attrs: { id: titleId } });
				}
			}];
		}
	};
}

export function CloseButtonPlugin(pluginOptions = {}) {
	let options = null;

	return {
		name: 'closeButton',
		install(context) {
			options = { slot: 'header.end', order: 1000, label: 'Close', ariaLabel: 'Close dialog', className: '', ...pluginOptions, ...context.getPluginOptions('closeButton') };
		},
		slotContributions(context) {
			return [{
				slot: options.slot,
				order: options.order,
				render() {
					if (context.getOptions().closable === false || options.enabled === false) {
						return null;
					}

					return createButton({
						className: ['md-button', 'md-close-button', options.className],
						text: options.label,
						ariaLabel: options.ariaLabel,
						dataset: { mdClose: '1' },
						onClick(event) {
							event.preventDefault();
							context.execute('close', { source: 'closeButton', nativeEvent: event });
						}
					});
				}
			}];
		}
	};
}

export function StatusPlugin(pluginOptions = {}) {
	let options = null;

	return {
		name: 'status',
		install(context) {
			options = { slot: 'footer.start', order: 10, renderEmpty: true, ariaLive: 'polite', ...pluginOptions, ...context.getPluginOptions('status') };
			context.setState({ status: normalizeStatus(options.status ?? context.getOptions().status ?? '') });
			context.commands.register('setStatus', (payload) => {
				const status = normalizeStatus(payload);
				context.setState({ status });
				context.emit('statusChange', { status });
				context.requestRender();
			});
			context.commands.register('clearStatus', () => context.execute('setStatus', ''));
		},
		slotContributions() {
			return [{
				slot: options.slot,
				order: options.order,
				render({ state }) {
					const status = normalizeStatus(state.status || '');

					if (!status.message && !options.renderEmpty) {
						return null;
					}

					return createElement('div', {
						className: ['md-status', status.type ? `md-status-${status.type}` : ''],
						text: status.html ? undefined : status.message,
						html: status.html ? status.message : undefined,
						attrs: { role: status.type === 'error' ? 'alert' : 'status', 'aria-live': options.ariaLive }
					});
				}
			}];
		}
	};
}

export function ButtonBarPlugin(pluginOptions = {}) {
	let options = null;

	return {
		name: 'buttonBar',
		install(context) {
			options = { slot: 'footer.end', order: 10, reportErrorsToStatus: true, ...pluginOptions, ...context.getPluginOptions('buttonBar') };
			context.setState({ buttons: normalizeButtons(options.buttons ?? context.getOptions().buttons ?? []), buttonStates: {} });
			context.commands.register('setButtons', (payload) => {
				context.setState({ buttons: normalizeButtons(payload && payload.buttons ? payload.buttons : payload), buttonStates: {} });
				context.requestRender();
			});
			context.commands.register('enableButton', (payload) => updateButtonState(context, resolveButtonKey(payload), { disabled: false }));
			context.commands.register('disableButton', (payload) => updateButtonState(context, resolveButtonKey(payload), { disabled: true }));
			context.commands.register('setButtonBusy', (payload) => updateButtonState(context, resolveButtonKey(payload), { busy: payload?.busy ?? true }));
			context.commands.register('clickButton', (payload) => {
				const key = resolveButtonKey(payload);
				const button = context.getState().buttons.find((item) => item.key === key);

				if (!button) {
					throw new Error(`ModularDialog button not found: ${key}`);
				}

				return runButtonAction(context, button, null, options);
			});
		},
		slotContributions(context) {
			return [{
				slot: options.slot,
				order: options.order,
				render({ state }) {
					const buttons = state.buttons || [];

					if (buttons.length === 0) {
						return null;
					}

					const bar = createElement('div', { className: 'md-button-bar' });

					for (const button of buttons) {
						const buttonState = state.buttonStates?.[button.key] || {};

						if (button.hidden || buttonState.hidden) {
							continue;
						}

						const busy = Boolean(button.busy || buttonState.busy);
						const disabled = Boolean(button.disabled || buttonState.disabled || busy || state.busy);
						bar.appendChild(createButton({
							className: ['md-button', button.primary ? 'md-button-primary' : '', button.danger ? 'md-button-danger' : '', button.secondary ? 'md-button-secondary' : '', busy ? 'md-button-busy' : '', button.className],
							text: busy && button.busyLabel ? button.busyLabel : button.label,
							title: button.title,
							disabled,
							busy,
							dataset: { mdButton: button.key },
							onClick(event) {
								event.preventDefault();
								void runButtonAction(context, button, event, options);
							}
						}));
					}

					return bar;
				}
			}];
		}
	};
}

export function BackdropPlugin(pluginOptions = {}) {
	let handler = null;

	return {
		name: 'backdrop',
		install(context) {
			const options = { ...pluginOptions, ...context.getPluginOptions('backdrop') };
			const backdrop = context.dialog.getBackdropElement();
			handler = (event) => {
				if (!context.getState().open || !context.dialog.isTop()) {
					return;
				}

				if ((options.closeOnBackdrop ?? context.getOptions().closeOnBackdrop) && event.target === backdrop) {
					context.execute('close', { source: 'backdrop', nativeEvent: event });
				}
			};
			backdrop.addEventListener('mousedown', handler);
		},
		destroy(context) {
			if (handler && context.dialog.getBackdropElement()) {
				context.dialog.getBackdropElement().removeEventListener('mousedown', handler);
			}
			handler = null;
		}
	};
}

export function KeyboardPlugin(pluginOptions = {}) {
	let handler = null;

	return {
		name: 'keyboard',
		install(context) {
			const options = { ...pluginOptions, ...context.getPluginOptions('keyboard') };
			handler = (event) => {
				if (!context.getState().open || !context.dialog.isTop()) {
					return;
				}

				if (event.key === 'Escape' && (options.closeOnEscape ?? context.getOptions().closeOnEscape)) {
					event.preventDefault();
					context.execute('close', { source: 'keyboard', nativeEvent: event });
				}
			};
			document.addEventListener('keydown', handler);
		},
		destroy() {
			if (handler) {
				document.removeEventListener('keydown', handler);
			}
			handler = null;
		}
	};
}

export function FocusTrapPlugin(pluginOptions = {}) {
	let previousFocus = null;
	let handler = null;
	let disposers = [];

	return {
		name: 'focusTrap',
		install(context) {
			const options = { ...pluginOptions, ...context.getPluginOptions('focusTrap') };
			disposers = [
				context.events.on('beforeOpen', () => {
					previousFocus = document.activeElement;
				}),
				context.events.on('afterOpen', () => focusInitialElement(context, options)),
				context.events.on('afterClose', () => {
					if ((options.restoreFocus ?? context.getOptions().restoreFocus) && previousFocus) {
						focusElement(previousFocus);
					}

					previousFocus = null;
				})
			];
			handler = (event) => {
				if (event.key !== 'Tab' || !context.getState().open || !context.dialog.isTop() || !(options.trapFocus ?? context.getOptions().trapFocus)) {
					return;
				}

				trapTabKey(context.dialog.getSurfaceElement(), event);
			};
			document.addEventListener('keydown', handler);
		},
		destroy() {
			disposers.forEach((dispose) => dispose());
			disposers = [];

			if (handler) {
				document.removeEventListener('keydown', handler);
			}

			handler = null;
		}
	};
}

export function DirtyGuardPlugin(pluginOptions = {}) {
	let dispose = null;

	return {
		name: 'dirtyGuard',
		install(context) {
			const options = { dirty: false, confirm: false, message: 'There are unsaved changes. Close anyway?', statusMessage: 'Please save or discard your changes before closing.', ...pluginOptions, ...context.getPluginOptions('dirtyGuard') };
			context.setState({ dirty: Boolean(options.dirty) });
			context.commands.register('setDirty', (payload) => {
				const dirty = payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'dirty') ? Boolean(payload.dirty) : Boolean(payload);
				context.setState({ dirty });
				context.emit('dirtyChange', { dirty });
			});
			context.commands.register('markDirty', () => context.execute('setDirty', true));
			context.commands.register('clearDirty', () => context.execute('setDirty', false));
			dispose = context.events.on('beforeClose', (event) => {
				if (!context.getState().dirty || event.detail?.force) {
					return;
				}

				if (allowDirtyClose(context, event, options)) {
					return;
				}

				event.preventDefault();
				context.emit('dirtyCloseBlocked', { event });

				if (options.statusMessage && context.commands.has('setStatus')) {
					context.execute('setStatus', { message: options.statusMessage, type: 'warning' });
				}
			});
		},
		destroy() {
			if (dispose) {
				dispose();
			}
		}
	};
}

export function AsyncActionPlugin(pluginOptions = {}) {
	let options = null;

	return {
		name: 'asyncAction',
		install(context) {
			options = { reportErrorsToStatus: true, ...pluginOptions, ...context.getPluginOptions('asyncAction') };
		},
		commands: {
			async runAsyncAction(context, payload = {}) {
				if (typeof payload.action !== 'function') {
					throw new Error('ModularDialog runAsyncAction requires an action function.');
				}

				context.setState({ busy: true });
				context.requestRender();

				if (payload.loadingStatus && context.commands.has('setStatus')) {
					context.execute('setStatus', normalizeStatusPayload(payload.loadingStatus, 'loading'));
				}

				try {
					const result = await payload.action(context.dialog, payload);

					if (payload.successStatus && context.commands.has('setStatus')) {
						context.execute('setStatus', normalizeStatusPayload(payload.successStatus, 'ok'));
					}

					context.emit('asyncActionEnd', { ...payload, result });

					return result;
				} catch (error) {
					context.emit('asyncActionError', { ...payload, error });

					if (options.reportErrorsToStatus && context.commands.has('setStatus')) {
						context.execute('setStatus', { message: error && error.message ? error.message : String(error), type: 'error' });
					}

					throw error;
				} finally {
					context.setState({ busy: false });
					context.requestRender();
				}
			}
		}
	};
}

export function DraggablePlugin(pluginOptions = {}) {
	let downHandler = null;
	let moveHandler = null;
	let upHandler = null;
	let options = null;
	let disposers = [];

	return {
		name: 'draggable',
		install(context) {
			options = { handleSelector: '[data-md-drag-handle]', enabled: undefined, ...pluginOptions, ...context.getPluginOptions('draggable') };
			context.setState({ position: context.getState().position || { x: 0, y: 0 } });
			context.commands.register('resetPosition', () => {
				context.setState({ position: { x: 0, y: 0 } });
				applyPosition(context, options);
			});
			disposers = [context.events.on('afterRender', () => applyPosition(context, options))];
			downHandler = (event) => {
				if (!isDragEnabled(context, options) || !context.getState().open || (event.button !== undefined && event.button !== 0)) {
					return;
				}

				const surface = context.dialog.getSurfaceElement();
				const handle = event.target.closest?.(options.handleSelector);

				if (!handle || !surface.contains(handle)) {
					return;
				}

				event.preventDefault();
				startDrag(context, event);
			};
			context.dialog.getSurfaceElement().addEventListener('pointerdown', downHandler);
		},
		destroy(context) {
			disposers.forEach((dispose) => dispose());
			const surface = context.dialog.getSurfaceElement();

			if (surface && downHandler) {
				surface.removeEventListener('pointerdown', downHandler);
			}

			removeDragListeners();
		}
	};

	function startDrag(context, event) {
		const start = context.getState().position || { x: 0, y: 0 };
		const startX = event.clientX;
		const startY = event.clientY;
		context.emit('dragStart', { ...start, nativeEvent: event });
		moveHandler = (moveEvent) => {
			const position = { x: start.x + moveEvent.clientX - startX, y: start.y + moveEvent.clientY - startY };
			context.setState({ position });
			applyPosition(context, options);
			context.emit('drag', { ...position, nativeEvent: moveEvent });
		};
		upHandler = (upEvent) => {
			removeDragListeners();
			context.emit('dragEnd', { ...(context.getState().position || { x: 0, y: 0 }), nativeEvent: upEvent });
		};
		document.addEventListener('pointermove', moveHandler);
		document.addEventListener('pointerup', upHandler, { once: true });
	}

	function removeDragListeners() {
		if (moveHandler) {
			document.removeEventListener('pointermove', moveHandler);
			moveHandler = null;
		}

		if (upHandler) {
			document.removeEventListener('pointerup', upHandler);
			upHandler = null;
		}
	}
}

export function ResizablePlugin(pluginOptions = {}) {
	let options = null;
	let disposers = [];

	return {
		name: 'resizable',
		install(context) {
			options = { enabled: undefined, minWidth: null, minHeight: null, ...pluginOptions, ...context.getPluginOptions('resizable') };
			context.commands.register('setSize', (payload = {}) => {
				context.setState({ size: { width: payload.width ?? null, height: payload.height ?? null } });
				applyResizable(context, options);
			});
			context.commands.register('resetSize', () => {
				context.setState({ size: { width: null, height: null } });
				applyResizable(context, options);
			});
			disposers = [context.events.on('afterRender', () => applyResizable(context, options))];
		},
		destroy(context) {
			disposers.forEach((dispose) => dispose());
			const surface = context.dialog.getSurfaceElement();

			if (surface) {
				surface.classList.remove('md-resizable');
				surface.style.resize = '';
			}
		}
	};
}

function normalizeDialogOptions(options = {}) {
	const id = options.id || uniqueId('modular-dialog');

	return {
		id,
		appendTo: null,
		className: '',
		surfaceClassName: '',
		size: 'large',
		width: null,
		height: null,
		maxWidth: null,
		maxHeight: null,
		modal: true,
		role: 'dialog',
		autoOpen: false,
		autoFocus: true,
		trapFocus: true,
		restoreFocus: true,
		initialFocus: null,
		closable: true,
		closeOnEscape: true,
		closeOnBackdrop: true,
		defaultSlots: ['main'],
		slots: {},
		content: null,
		plugins: [],
		pluginOptions: {},
		defaultPlugins: true,
		zIndexBase: 9000,
		ariaLabel: null,
		ariaLabelledBy: null,
		ariaDescribedBy: null,
		...options,
		id
	};
}

function uniqueId(prefix) {
	internalId += 1;

	return `${prefix}-${internalId}`;
}

function isPlainObject(value) {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

function resolveContainer(target) {
	if (!target) {
		return document.body;
	}

	const container = typeof target === 'string' ? document.querySelector(target) : target;

	if (!container) {
		throw new Error(`ModularDialog append target not found: ${target}`);
	}

	return container;
}

function createElement(tagName, options = {}) {
	const element = document.createElement(tagName);

	if (options.className) {
		element.className = Array.isArray(options.className) ? options.className.filter(Boolean).join(' ') : String(options.className);
	}

	if (options.text !== undefined) {
		element.textContent = options.text;
	}

	if (options.html !== undefined) {
		element.innerHTML = options.html;
	}

	if (options.attrs) {
		setAttributes(element, options.attrs);
	}

	if (options.dataset) {
		for (const [name, value] of Object.entries(options.dataset)) {
			if (value !== undefined && value !== null) {
				element.dataset[name] = String(value);
			}
		}
	}

	if (typeof options.onClick === 'function') {
		element.addEventListener('click', options.onClick);
	}

	return element;
}

function createButton(options = {}) {
	return createElement('button', {
		className: options.className || 'md-button',
		text: options.text ?? options.label ?? '',
		attrs: {
			type: 'button',
			title: options.title,
			'aria-label': options.ariaLabel,
			'aria-busy': options.busy ? 'true' : undefined,
			disabled: options.disabled ? 'disabled' : undefined,
			...(options.attrs || {})
		},
		dataset: options.dataset,
		onClick: options.onClick
	});
}

function setAttributes(element, attrs = {}) {
	for (const [name, value] of Object.entries(attrs)) {
		if (value === undefined || value === null || value === false) {
			element.removeAttribute(name);
			continue;
		}

		if (value === true) {
			element.setAttribute(name, name);
			continue;
		}

		element.setAttribute(name, String(value));
	}
}

function appendContent(element, content, options = {}) {
	if (content === null || content === undefined || content === false) {
		return;
	}

	if (Array.isArray(content) || isNodeList(content)) {
		for (const item of Array.from(content)) {
			appendContent(element, item, options);
		}
		return;
	}

	if (typeof content === 'string') {
		if (options.html) {
			const template = document.createElement('template');
			template.innerHTML = content;
			element.appendChild(template.content);
			return;
		}

		element.appendChild(document.createTextNode(content));
		return;
	}

	if (typeof content === 'number' || typeof content === 'boolean') {
		element.appendChild(document.createTextNode(String(content)));
		return;
	}

	if (isNode(content)) {
		element.appendChild(content);
		return;
	}

	if (content.element && isNode(content.element)) {
		element.appendChild(content.element);
		return;
	}

	element.appendChild(document.createTextNode(String(content)));
}

function clearElement(element) {
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
}

function isNode(value) {
	return Boolean(value && typeof value === 'object' && typeof value.nodeType === 'number');
}

function isNodeList(value) {
	return Boolean(value && typeof value === 'object' && typeof value.length === 'number' && typeof value.item === 'function');
}

function slotNameClass(slotName) {
	return `md-slot-${String(slotName).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
}

function normalizeContributions(contributions = []) {
	return contributions.map((contribution) => ({
		key: contribution.key || uniqueId('slot-contribution'),
		order: contribution.order || 0,
		render: contribution.render,
		content: contribution.content,
		html: Boolean(contribution.html),
		source: contribution.source || 'plugin'
	}));
}

function sortEntries(left, right) {
	if ((left.order || 0) !== (right.order || 0)) {
		return (left.order || 0) - (right.order || 0);
	}

	return String(left.key || '').localeCompare(String(right.key || ''));
}

function getPluginContributions(plugin, context) {
	let contributions = [];

	if (typeof plugin.slotContributions === 'function') {
		contributions = contributions.concat(plugin.slotContributions(context) || []);
	}

	if (typeof plugin.layoutContributions === 'function') {
		contributions = contributions.concat(plugin.layoutContributions(context) || []);
	}

	return contributions;
}

function appendRendered(parent, child) {
	if (child) {
		parent.appendChild(child);
	}
}

function normalizeStatus(payload) {
	if (payload && typeof payload === 'object') {
		return { message: payload.message == null ? '' : String(payload.message), type: payload.type || '', html: Boolean(payload.html) };
	}

	return { message: payload == null ? '' : String(payload), type: '', html: false };
}

function normalizeButtons(buttons = []) {
	if (!Array.isArray(buttons) && buttons && typeof buttons === 'object') {
		return Object.entries(buttons).map(([key, button]) => ({ key, ...(button || {}) }));
	}

	return (buttons || []).map((button, index) => ({ key: button.key || button.name || `button-${index + 1}`, label: button.label || button.text || button.key || `Button ${index + 1}`, ...button }));
}

function resolveButtonKey(payload) {
	if (payload && typeof payload === 'object') {
		return payload.key || payload.name || payload.button;
	}

	return payload;
}

function updateButtonState(context, key, patch) {
	if (!key) {
		throw new Error('ModularDialog button state update requires a button key.');
	}

	const state = context.getState();
	const buttonStates = { ...(state.buttonStates || {}), [key]: { ...(state.buttonStates?.[key] || {}), ...patch } };
	context.setState({ buttonStates });
	context.requestRender();
}

async function runButtonAction(context, button, nativeEvent, options) {
	const state = context.getState();
	const buttonState = state.buttonStates?.[button.key] || {};

	if (button.disabled || buttonState.disabled || buttonState.busy || state.busy) {
		return undefined;
	}

	const clickEvent = context.emit('buttonClick', { button, key: button.key, nativeEvent }, { cancelable: true });

	if (clickEvent.defaultPrevented) {
		return undefined;
	}

	let result;
	let shouldClearBusy = false;

	try {
		result = executeButtonAction(context, button, nativeEvent);

		if (button.async || (result && typeof result.then === 'function')) {
			updateButtonState(context, button.key, { busy: true });
			shouldClearBusy = true;
			context.emit('buttonActionStart', { button, key: button.key });
		}

		if (result && typeof result.then === 'function') {
			result = await result;
		}

		context.emit('buttonActionEnd', { button, key: button.key, result });

		if (button.closeOnAction) {
			context.execute('close', { source: 'button', key: button.key });
		}

		return result;
	} catch (error) {
		context.emit('buttonActionError', { button, key: button.key, error });

		if (options.reportErrorsToStatus && context.commands.has('setStatus')) {
			context.execute('setStatus', { message: error && error.message ? error.message : String(error), type: 'error' });
		}

		if (button.rethrow) {
			throw error;
		}

		return undefined;
	} finally {
		if (shouldClearBusy) {
			updateButtonState(context, button.key, { busy: false });
		}
	}
}

function executeButtonAction(context, button, nativeEvent) {
	const detail = { button, key: button.key, nativeEvent };

	if (button.action === 'close') {
		return context.execute('close', { source: 'button', key: button.key, nativeEvent });
	}

	if (typeof button.action === 'string') {
		return context.execute(button.action, detail);
	}

	if (typeof button.command === 'string') {
		return context.execute(button.command, detail);
	}

	if (typeof button.action === 'function') {
		return button.action(context.dialog, detail);
	}

	return undefined;
}

function getFocusableElements(root) {
	const selector = ['a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])', 'textarea:not([disabled])', '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'].join(',');
	return Array.from(root.querySelectorAll(selector)).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function focusElement(element) {
	if (!element || typeof element.focus !== 'function') {
		return false;
	}

	try {
		element.focus({ preventScroll: true });
	} catch (error) {
		element.focus();
	}

	return document.activeElement === element;
}

function focusInitialElement(context, options) {
	if (options.autoFocus === false || context.getOptions().autoFocus === false) {
		return;
	}

	const surface = context.dialog.getSurfaceElement();
	const target = options.initialFocus ?? context.getOptions().initialFocus;
	const requestedElement = typeof target === 'string' ? surface.querySelector(target) : (typeof target === 'function' ? target(surface) : target);

	if (focusElement(requestedElement)) {
		return;
	}

	const focusables = getFocusableElements(surface);

	if (focusables.length > 0 && focusElement(focusables[0])) {
		return;
	}

	focusElement(surface);
}

function trapTabKey(surface, event) {
	const focusables = getFocusableElements(surface);

	if (focusables.length === 0) {
		event.preventDefault();
		focusElement(surface);
		return;
	}

	const first = focusables[0];
	const last = focusables[focusables.length - 1];
	const active = document.activeElement;

	if (event.shiftKey && (active === first || !surface.contains(active))) {
		event.preventDefault();
		focusElement(last);
		return;
	}

	if (!event.shiftKey && active === last) {
		event.preventDefault();
		focusElement(first);
	}
}

function allowDirtyClose(context, event, options) {
	if (typeof options.confirm === 'function') {
		return options.confirm(context.dialog, event) !== false;
	}

	if (options.confirm && typeof window !== 'undefined' && typeof window.confirm === 'function') {
		return window.confirm(typeof options.confirm === 'string' ? options.confirm : options.message);
	}

	return false;
}

function normalizeStatusPayload(status, fallbackType) {
	if (status && typeof status === 'object') {
		return status;
	}

	return { message: status == null ? '' : String(status), type: fallbackType };
}

function isDragEnabled(context, options) {
	return options.enabled !== undefined ? Boolean(options.enabled) : Boolean(context.getOptions().draggable);
}

function applyPosition(context, options) {
	const surface = context.dialog.getSurfaceElement();

	if (!surface) {
		return;
	}

	const position = context.getState().position || { x: 0, y: 0 };
	surface.classList.toggle('md-draggable', isDragEnabled(context, options));
	surface.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
}

function applyResizable(context, options) {
	const surface = context.dialog.getSurfaceElement();

	if (!surface) {
		return;
	}

	const enabled = options.enabled !== undefined ? Boolean(options.enabled) : Boolean(context.getOptions().resizable);
	const size = context.getState().size || {};
	surface.classList.toggle('md-resizable', enabled);
	surface.style.resize = enabled ? 'both' : '';

	if (options.minWidth) {
		surface.style.minWidth = typeof options.minWidth === 'number' ? `${options.minWidth}px` : String(options.minWidth);
	}

	if (options.minHeight) {
		surface.style.minHeight = typeof options.minHeight === 'number' ? `${options.minHeight}px` : String(options.minHeight);
	}

	if (size.width) {
		surface.style.width = typeof size.width === 'number' ? `${size.width}px` : String(size.width);
	}

	if (size.height) {
		surface.style.height = typeof size.height === 'number' ? `${size.height}px` : String(size.height);
	}
}

function applyDimension(element, property, value) {
	if (value !== undefined && value !== null && value !== '') {
		element.style[property] = typeof value === 'number' ? `${value}px` : String(value);
	}
}
