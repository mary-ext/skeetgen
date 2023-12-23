export const PAGINATION_DOT_START = 'dots_start';
export const PAGINATION_DOT_END = 'dots_end';
export const PAGINATION_PREVIOUS = 'prev';
export const PAGINATION_NEXT = 'next';

export function create_pagination(
	page: number,
	total: number,
	boundary_count: number = 1,
	sibling_count: number = 1,
) {
	const pages_start = range(1, Math.min(boundary_count, total));
	const pages_end = range(Math.max(total - boundary_count + 1, boundary_count + 1), total);

	const siblings_start = Math.max(
		Math.min(page - sibling_count, total - boundary_count - sibling_count * 2 - 1),
		boundary_count + 2,
	);

	const siblings_end = Math.min(
		Math.max(page + sibling_count, boundary_count + sibling_count * 2 + 2),
		pages_end.length > 0 ? pages_end[0] - 2 : total - 1,
	);

	return [
		PAGINATION_PREVIOUS,
		...pages_start,

		...(siblings_start > boundary_count + 2
			? [PAGINATION_DOT_START]
			: boundary_count + 1 < total - boundary_count
				? [boundary_count + 1]
				: []),

		// Sibling pages
		...range(siblings_start, siblings_end),

		...(siblings_end < total - boundary_count - 1
			? [PAGINATION_DOT_END]
			: total - boundary_count > boundary_count
				? [total - boundary_count]
				: []),

		...pages_end,
		PAGINATION_NEXT,
	];
}

function range(start: number, end: number) {
	const length = end - start + 1;
	return Array.from({ length }, (_, index) => start + index);
}
