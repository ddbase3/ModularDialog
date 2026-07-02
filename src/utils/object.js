export function isPlainObject(value) {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

export function mergeDeep(target = {}, source = {}) {
	const output = { ...target };

	for (const [key, value] of Object.entries(source || {})) {
		if (isPlainObject(value) && isPlainObject(output[key])) {
			output[key] = mergeDeep(output[key], value);
			continue;
		}

		output[key] = value;
	}

	return output;
}

export function asArray(value) {
	if (value === undefined || value === null) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}
