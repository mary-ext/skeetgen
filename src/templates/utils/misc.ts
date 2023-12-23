export function clsx(classes: Array<string | 0 | false | null | undefined>): string {
	let str = '';
	let tmp: any;

	for (let i = 0, ilen = classes.length; i < ilen; i++) {
		if ((tmp = classes[i])) {
			str && (str += ' ');
			str += tmp;
		}
	}

	return str;
}

export function chunked<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];

	for (let i = 0, ilen = arr.length; i < ilen; i += size) {
		chunks.push(arr.slice(i, i + size));
	}

	return chunks;
}
