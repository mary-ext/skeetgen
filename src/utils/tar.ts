import type { IterableReader } from './misc.ts';

export interface TarFileAttributes {
	/** @default 0o664 */
	mode?: number;
	/** @default 1000 */
	uid?: number;
	/** @default 1000 */
	gid?: number;
	/** @default Date.now() */
	mtime?: number;
	/** @default "" */
	user?: string;
	/** @default "" */
	group?: string;
}

export interface TarFileEntry {
	filename: string;
	data: string | Uint8Array | ArrayBuffer;
	attrs?: TarFileAttributes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const RECORD_SIZE = 512;
/** Accounts for the 8 spaces in the checksum field */
const INITIAL_CHKSUM = 8 * 32;

const DEFAULT_ATTRS: TarFileAttributes = {};

const FILE_TYPES: Record<number, string> = {
	0: 'file',
	1: 'link',
	2: 'symlink',
	3: 'character_device',
	4: 'block_device',
	5: 'directory',
	6: 'fifo',
	7: 'contiguous_file',
};

export function write_tar_entry(entry: TarFileEntry): ArrayBuffer {
	const { filename, data, attrs = DEFAULT_ATTRS } = entry;

	let name = filename;
	let prefix = '';

	if (name.length > 100) {
		let i = 0;
		while (name.length > 100) {
			i = filename.indexOf('/', i);

			if (i === -1) {
				break;
			}

			prefix = filename.slice(0, i);
			name = filename.slice(i + 1);
		}

		if (name.length > 100 || prefix.length > 155) {
			const total_length = (prefix.length && prefix.length + 1) + name.length;
			throw new Error(`filename is too long (${total_length})`);
		}
	}

	const data_buf = normalize_data(data);
	const data_size = data_buf.byteLength;

	const padding_size = RECORD_SIZE - (data_size % RECORD_SIZE || RECORD_SIZE);

	const buf = new ArrayBuffer(512 + data_size + padding_size);

	// File name
	write_str(buf, name, 0, 100);

	// File mode
	write_str(buf, pad(attrs.mode ?? 0o664, 7), 100, 8);

	// UID
	write_str(buf, pad(attrs.uid ?? 1000, 7), 108, 8);

	// GID
	write_str(buf, pad(attrs.gid ?? 1000, 7), 116, 8);

	// File size
	write_str(buf, pad(data_size, 11), 124, 12);

	// Modified time
	write_str(buf, pad(attrs.mtime ?? Date.now(), 11), 136, 12);

	// File type
	write_str(buf, '0', 156, 12);

	// Ustar
	write_str(buf, 'ustar00', 257, 8);

	// User ownership
	write_str(buf, attrs.user ?? '', 265, 32);

	// User group
	write_str(buf, attrs.group ?? '', 297, 32);

	// File prefix
	write_str(buf, prefix, 345, 155);

	// Checksum
	{
		const header = new Uint8Array(buf, 0, 512);
		const chksum = get_checksum(header);

		write_str(buf, pad(chksum, 8), 148, 8);
	}

	// Actual data
	{
		const dest = new Uint8Array(buf, 512, data_size);
		dest.set(data_buf, 0);
	}

	return buf;
}

export async function* untar(reader: IterableReader): AsyncGenerator<TarEntry> {
	const header = new Uint8Array(512);

	let entry: TarEntry | undefined;

	while (true) {
		if (entry) {
			await entry.discard();
		}

		const res = await reader.read(header);

		if (res === null) {
			break;
		}

		// validate checksum
		{
			const expected = read_octal(header, 148, 8);
			const actual = get_checksum(header);
			if (expected !== actual) {
				if (actual === INITIAL_CHKSUM) {
					break;
				}

				throw new Error(`invalid checksum, expected ${expected} got ${actual}`);
			}
		}

		// validate magic
		{
			const magic = read_str(header, 257, 8);
			if (!magic.startsWith('ustar')) {
				throw new Error(`unsupported archive format: ${magic}`);
			}
		}

		entry = new TarEntry(header, reader);
		yield entry;
	}
}

class TarEntry {
	private reader: IterableReader;

	private bytes_read: number = 0;

	readonly name: string;
	readonly mode: number;
	readonly uid: number;
	readonly gid: number;
	readonly size: number;
	readonly mtime: number;
	readonly type: string;
	readonly link_name: string;
	readonly owner: string;
	readonly group: string;
	readonly entry_size: number;

	constructor(header: Uint8Array, reader: IterableReader) {
		const name = read_str(header, 0, 100);
		const mode = read_octal(header, 100, 8);
		const uid = read_octal(header, 108, 8);
		const gid = read_octal(header, 116, 8);
		const size = read_octal(header, 124, 12);
		const mtime = read_octal(header, 136, 12);
		const type = read_octal(header, 156, 1);
		const link_name = read_str(header, 157, 100);
		const owner = read_str(header, 265, 32);
		const group = read_str(header, 297, 32);
		const prefix = read_str(header, 345, 155);

		this.name = prefix.length > 0 ? prefix + '/' + name : name;
		this.mode = mode;
		this.uid = uid;
		this.gid = gid;
		this.size = size;
		this.mtime = mtime;
		this.type = FILE_TYPES[type] ?? '' + type;
		this.link_name = link_name;
		this.owner = owner;
		this.group = group;
		this.entry_size = Math.ceil(this.size / RECORD_SIZE) * RECORD_SIZE;

		this.reader = reader;
	}

	async read(p: Uint8Array): Promise<number | null> {
		let remaining = this.size - this.bytes_read;

		if (remaining <= 0) {
			return null;
		}

		if (p.byteLength <= remaining) {
			this.bytes_read += p.byteLength;
			return await this.reader.read(p);
		}

		// User exceeded the remaining size of this entry, we can't fulfill that
		// directly because it means reading partially into the next entry
		this.bytes_read += remaining;

		let block = new Uint8Array(remaining);
		let n = await this.reader.read(block);

		p.set(block, 0);
		return n;
	}

	async discard() {
		let remaining = this.entry_size - this.bytes_read;

		if (remaining <= 0) {
			return null;
		}

		await this.reader.seek(remaining);
	}
}

function get_checksum(buf: Uint8Array) {
	let checksum = INITIAL_CHKSUM;

	for (let i = 0; i < 512; i++) {
		// Ignore own checksum field
		if (i >= 148 && i < 156) {
			continue;
		}

		checksum += buf[i];
	}

	return checksum;
}

function write_str(buf: ArrayBuffer, str: string, offset: number, size: number) {
	const view = new Uint8Array(buf, offset, size);
	encoder.encodeInto(str, view);
}

function read_str(arr: Uint8Array, offset: number, size: number): string {
	let input = arr.subarray(offset, offset + size);

	for (let idx = 0, len = input.length; idx < len; idx++) {
		let code = input[idx];

		if (code === 0) {
			input = input.subarray(0, idx);
			break;
		}
	}

	return decoder.decode(input);
}

function read_octal(arr: Uint8Array, offset: number, size: number): number {
	const res = read_str(arr, offset, size);
	return res ? parseInt(res, 8) : 0;
}

function pad(input: number, length: number) {
	return input.toString(8).padStart(length, '0');
}

function normalize_data(data: string | ArrayBuffer | Uint8Array): Uint8Array {
	if (typeof data === 'string') {
		return encoder.encode(data);
	}

	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data);
	}

	return data;
}
