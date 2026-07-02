let idCounter = 0;

export function resolveElement(target, root = null) {
	if (!target) {
		return null;
	}

	const lookupRoot = root || getDocument();

	if (typeof target === 'string') {
		if (!lookupRoot || typeof lookupRoot.querySelector !== 'function') {
			throw new Error(`ModularDialog cannot resolve selector without a document: ${target}`);
		}

		const element = lookupRoot.querySelector(target);

		if (!element) {
			throw new Error(`ModularDialog target not found: ${target}`);
		}

		return element;
	}

	return target;
}

export function resolveContainer(target) {
	if (!target) {
		const currentDocument = getDocument();

		if (!currentDocument || !currentDocument.body) {
			throw new Error('ModularDialog requires a document body as append target.');
		}

		return currentDocument.body;
	}

	return resolveElement(target);
}

export function clearElement(element) {
	while (element && element.firstChild) {
		element.removeChild(element.firstChild);
	}
}

export function createElement(tagName, options = {}) {
	const currentDocument = options.document || getDocument();

	if (!currentDocument) {
		throw new Error(`ModularDialog cannot create <${tagName}> without a document.`);
	}

	const element = currentDocument.createElement(tagName);

	if (options.className) {
		element.className = normalizeClassNames(options.className);
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
			if (value === undefined || value === null) {
				continue;
			}

			element.dataset[name] = String(value);
		}
	}

	if (options.style) {
		Object.assign(element.style, options.style);
	}

	if (typeof options.onClick === 'function') {
		element.addEventListener('click', options.onClick);
	}

	if (typeof options.onInput === 'function') {
		element.addEventListener('input', options.onInput);
	}

	if (typeof options.onChange === 'function') {
		element.addEventListener('change', options.onChange);
	}

	if (typeof options.onKeydown === 'function') {
		element.addEventListener('keydown', options.onKeydown);
	}

	if (options.children !== undefined) {
		appendContent(element, options.children, { html: options.childrenHtml === true });
	}

	return element;
}

export function createButton(options = {}) {
	const label = options.text ?? options.label ?? '';

	return createElement('button', {
		className: options.className || 'md-button',
		text: label,
		attrs: {
			type: options.type || 'button',
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

export function setAttributes(element, attrs = {}) {
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

export function appendContent(element, content, options = {}) {
	if (content === null || content === undefined || content === false) {
		return;
	}

	if (Array.isArray(content)) {
		for (const item of content) {
			appendContent(element, item, options);
		}

		return;
	}

	if (isNodeList(content)) {
		for (const item of Array.from(content)) {
			appendContent(element, item, options);
		}

		return;
	}

	if (typeof content === 'string') {
		if (options.html) {
			const template = element.ownerDocument.createElement('template');
			template.innerHTML = content;
			element.appendChild(template.content);
			return;
		}

		element.appendChild(element.ownerDocument.createTextNode(content));
		return;
	}

	if (typeof content === 'number' || typeof content === 'boolean') {
		element.appendChild(element.ownerDocument.createTextNode(String(content)));
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

	if (content.html !== undefined) {
		appendContent(element, content.html, { html: true });
		return;
	}

	if (content.text !== undefined) {
		appendContent(element, content.text);
		return;
	}

	if (content.children !== undefined) {
		appendContent(element, content.children, options);
		return;
	}

	element.appendChild(element.ownerDocument.createTextNode(String(content)));
}

export function normalizeClassNames(value) {
	if (Array.isArray(value)) {
		return value.filter(Boolean).join(' ');
	}

	return String(value || '').trim();
}

export function uniqueId(prefix = 'md') {
	idCounter += 1;

	return `${prefix}-${idCounter}`;
}

export function toKebabCase(value) {
	return String(value || '')
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase();
}

export function slotNameClass(slotName) {
	return `md-slot-${toKebabCase(slotName)}`;
}

export function getFocusableElements(root) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return [];
	}

	const selectors = [
		'a[href]',
		'area[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'iframe',
		'object',
		'embed',
		'[contenteditable="true"]',
		'[tabindex]:not([tabindex="-1"])'
	];

	return Array.from(root.querySelectorAll(selectors.join(','))).filter((element) => {
		if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
			return false;
		}

		const style = element.ownerDocument.defaultView?.getComputedStyle(element);

		if (style && (style.visibility === 'hidden' || style.display === 'none')) {
			return false;
		}

		return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
	});
}

export function focusElement(element) {
	if (!element || typeof element.focus !== 'function') {
		return false;
	}

	try {
		element.focus({ preventScroll: true });
	} catch (error) {
		element.focus();
	}

	return element.ownerDocument.activeElement === element;
}

export function findClosest(element, selector, boundary = null) {
	if (!element || typeof element.closest !== 'function') {
		return null;
	}

	const match = element.closest(selector);

	if (!match) {
		return null;
	}

	if (boundary && !boundary.contains(match)) {
		return null;
	}

	return match;
}

export function isNode(value) {
	return Boolean(value && typeof value === 'object' && typeof value.nodeType === 'number');
}

export function isDomNode(value) {
	return isNode(value);
}

export function isNodeList(value) {
	return Boolean(
		value &&
		typeof value === 'object' &&
		typeof value.length === 'number' &&
		typeof value.item === 'function'
	);
}

export function getDocument() {
	return typeof document === 'undefined' ? null : document;
}
