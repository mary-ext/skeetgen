export function normalize_path(path: string): string {
	return path.replace(/\/{2,}/g, '/');
}

export function trim_path_trailing(path: string): string {
	return path.replace(/\/+$/, '');
}

export function join_path(...paths: string[]): string {
	return normalize_path(paths.join('/'));
}

export function split_path(path: string): string[] {
	return normalize_path(path).split('/');
}

export function is_posix_path_sep(code: number): boolean {
	return code === 47;
}

export function relative_path(from: string, to: string) {
	if (from === to) return '';

	// Trim any leading backslashes
	let from_start = 1;
	const from_end = from.length;
	for (; from_start < from_end; ++from_start) {
		if (!is_posix_path_sep(from.charCodeAt(from_start))) {
			break;
		}
	}
	const from_len = from_end - from_start;

	// Trim any leading backslashes
	let to_start = 1;
	const to_end = to.length;
	for (; to_start < to_end; ++to_start) {
		if (!is_posix_path_sep(to.charCodeAt(to_start))) {
			break;
		}
	}
	const to_len = to_end - to_start;

	// Compare paths to find the longest common path from root
	const length = from_len < to_len ? from_len : to_len;
	let last_common_sep = -1;
	let i = 0;
	for (; i <= length; ++i) {
		if (i === length) {
			if (to_len > length) {
				if (is_posix_path_sep(to.charCodeAt(to_start + i))) {
					// We get here if `from` is the exact base path for `to`.
					// For example: from='/foo/bar'; to='/foo/bar/baz'
					return to.slice(to_start + i + 1);
				} else if (i === 0) {
					// We get here if `from` is the root
					// For example: from='/'; to='/foo'
					return to.slice(to_start + i);
				}
			} else if (from_len > length) {
				if (is_posix_path_sep(from.charCodeAt(from_start + i))) {
					// We get here if `to` is the exact base path for `from`.
					// For example: from='/foo/bar/baz'; to='/foo/bar'
					last_common_sep = i;
				} else if (i === 0) {
					// We get here if `to` is the root.
					// For example: from='/foo'; to='/'
					last_common_sep = 0;
				}
			}
			break;
		}

		const from_code = from.charCodeAt(from_start + i);
		const to_code = to.charCodeAt(to_start + i);

		if (from_code !== to_code) {
			break;
		} else if (is_posix_path_sep(from_code)) {
			last_common_sep = i;
		}
	}

	let out = '';
	// Generate the relative path based on the path difference between `to`
	// and `from`
	for (i = from_start + last_common_sep + 1; i <= from_end; ++i) {
		if (i === from_end || is_posix_path_sep(from.charCodeAt(i))) {
			if (out.length === 0) {
				out += '..';
			} else {
				out += '/..';
			}
		}
	}

	// Lastly, append the rest of the destination (`to`) path that comes after
	// the common path parts
	if (out.length > 0) {
		return out + to.slice(to_start + last_common_sep);
	} else {
		to_start += last_common_sep;

		if (is_posix_path_sep(to.charCodeAt(to_start))) {
			++to_start;
		}

		return to.slice(to_start);
	}
}

export function get_dirname(path: string) {
	let end = -1;
	let matched_non_sep = false;

	for (let i = path.length - 1; i >= 1; --i) {
		if (is_posix_path_sep(path.charCodeAt(i))) {
			if (matched_non_sep) {
				end = i;
				break;
			}
		} else {
			matched_non_sep = true;
		}
	}

	// No matches. Fallback based on provided path:
	//
	// - leading slashes paths
	//     "/foo" => "/"
	//     "///foo" => "/"
	// - no slash path
	//     "foo" => "."
	if (end === -1) {
		return is_posix_path_sep(path.charCodeAt(0)) ? '/' : '.';
	}

	return trim_path_trailing(path.slice(0, end));
}
