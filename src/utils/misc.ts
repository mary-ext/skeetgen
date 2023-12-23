export async function* iterate_stream<T>(stream: ReadableStream<T>) {
	// Get a lock on the stream
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				return;
			}

			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

export function assert(condition: boolean, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

const EMPTY_BUFFER = new Uint8Array(0);

export interface IterableReader {
	read(p: Uint8Array): Promise<number | null>;
	seek(n: number): Promise<number>;
}

export function create_iterable_reader(iterable: AsyncIterable<Uint8Array>): IterableReader {
	const iterator = iterable[Symbol.asyncIterator]();

	let pages: Uint8Array[] = [];
	let buffer = EMPTY_BUFFER;

	let ptr = 0;
	let size = 0;
	let read = 0;

	return {
		async read(p: Uint8Array): Promise<number | null> {
			while (size < p.byteLength) {
				let result = await iterator.next();

				if (result.done) {
					break;
				}

				let chunk = result.value;
				let length = chunk.byteLength;

				size += length;
				read += length;

				pages.push(chunk);
			}

			if (size < 1) {
				pages = [];
				buffer = new Uint8Array(0);
				return null;
			}

			let unwritten = p.byteLength;

			while (unwritten > 0) {
				let remaining = buffer.byteLength - ptr;
				let length = Math.min(unwritten, remaining);

				p.set(buffer.subarray(ptr, ptr + length), p.byteLength - unwritten);

				ptr += length;
				unwritten -= length;
				size -= length;

				if (ptr >= buffer.length) {
					if (pages.length < 1) {
						break;
					}

					buffer = pages.shift()!;
					ptr = 0;
				}
			}

			return p.byteLength - unwritten;
		},
		async seek(n: number): Promise<number> {
			while (size < n) {
				let result = await iterator.next();

				if (result.done) {
					break;
				}

				let chunk = result.value;
				let length = chunk.byteLength;

				size += length;
				read += length;

				pages.push(chunk);
			}

			ptr += n;
			size -= n;
			read += n;

			while (ptr >= buffer.byteLength && pages.length > 0) {
				ptr -= buffer.byteLength;
				buffer = pages.shift()!;
			}

			return read;
		},
	};
}
