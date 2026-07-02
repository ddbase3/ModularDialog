import { setAttributes, uniqueId } from './dom.js';

export function ensureId(element, prefix = 'md-id') {
	if (!element.id) {
		element.id = uniqueId(prefix);
	}

	return element.id;
}

export function applyDialogA11y(surface, options = {}) {
	setAttributes(surface, {
		role: options.role || 'dialog',
		'aria-modal': options.modal ? 'true' : undefined,
		'aria-label': options.ariaLabel,
		'aria-labelledby': options.ariaLabelledBy,
		'aria-describedby': options.ariaDescribedBy,
		tabindex: '-1'
	});
}

export function resolveFocusTarget(surface, target) {
	if (!target) {
		return null;
	}

	if (typeof target === 'string') {
		return surface.querySelector(target);
	}

	if (typeof target === 'function') {
		return target(surface);
	}

	return target;
}
