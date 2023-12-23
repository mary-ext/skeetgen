import { type FileSystemFileHandle, showSaveFilePicker } from 'native-file-system-adapter';

import { type DidDocument, Agent, getPdsEndpoint } from '@externdefs/bluesky-client/agent';
import { ResponseType, XRPCError, type XRPCResponse } from '@externdefs/bluesky-client/xrpc-utils';

import { target } from '../utils/controller.ts';
import { format_bytes } from '../utils/format-bytes.ts';
import { iterate_stream } from '../utils/misc.ts';
import { write_tar_entry } from '../utils/tar.ts';

type DID = `did:${string}`;

const APPVIEW_URL = 'https://api.bsky.app';
const HOST_RE = /^([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*(?:\.[a-zA-Z]+))$/;

const is_did = (str: string): str is DID => {
	return str.startsWith('did:');
};

const supports_fsa = 'showDirectoryPicker' in globalThis;

class ExportDataForm extends HTMLElement {
	private form = target<HTMLFormElement>(this, 'form');
	private status = target<HTMLParagraphElement>(this, 'status');

	private fsa_warning = target<HTMLDivElement>(this, 'fsa_warning');

	private object_url: string | undefined;

	connectedCallback() {
		if (!supports_fsa) {
			const $fsa_warning = this.fsa_warning.get()!;
			$fsa_warning.style.display = '';
		}

		{
			const $form = this.form.get()!;
			const $status = this.status.get()!;

			let controller: AbortController | undefined;

			$form.addEventListener('submit', (ev) => {
				ev.preventDefault();

				controller?.abort();
				controller = new AbortController();

				const data = new FormData($form);
				const identifier = (data.get('identifier') as string).replace(/^@/, '');
				const with_media = !!data.get('with_media');

				const signal = controller.signal;

				if (this.object_url) {
					URL.revokeObjectURL(this.object_url);
					this.object_url = undefined;
				}

				$status.textContent = '';
				$status.classList.remove('text-red-500');
				$status.classList.add('opacity-50');

				const date = new Date().toISOString();

				const promise = showSaveFilePicker({
					suggestedName: `${date}-${identifier}.tar`,

					// @ts-expect-error - not sure why the polyfill isn't typed correctly.
					id: 'bluesky-export',
					startIn: 'downloads',
					types: [
						{
							description: 'TAR archive',
							accept: { 'application/x-tar': ['.tar'] },
						},
					],
				});

				promise.then((fd) => {
					if (signal.aborted) {
						return;
					}

					this.download_archive(signal, fd, identifier, with_media).then(
						() => {
							// If we got here, we're still dealing with our own controller.
							controller!.abort();
						},
						(err) => {
							if (signal.aborted) {
								return;
							}

							$status.textContent = err.message;
							$status.classList.add('text-red-500');
							$status.classList.remove('opacity-50');
						},
					);
				});
			});
		}
	}

	async download_archive(
		signal: AbortSignal,
		fd: FileSystemFileHandle,
		identifier: string,
		with_media: boolean,
	) {
		const $status = this.status.get()!;

		// 1. Resolve DID if it's not one
		let did: DID;
		{
			if (is_did(identifier)) {
				did = identifier;
			} else {
				$status.textContent = `Resolving handle...`;

				const agent = new Agent({ serviceUri: APPVIEW_URL });

				const response = await agent.rpc.get('com.atproto.identity.resolveHandle', {
					signal: signal,
					params: {
						handle: identifier,
					},
				});

				did = response.data.did;
			}
		}

		// 2. Retrieve the DID document
		let doc: DidDocument;
		{
			const [, type, ...rest] = did.split(':');
			const ident = rest.join(':');

			if (type === 'plc') {
				$status.textContent = `Contacting PLC directory...`;

				const response = await fetch(`https://plc.directory/${did}`, { signal: signal });

				if (response.status === 404) {
					throw new Error(`DID not registered`);
				} else if (!response.ok) {
					throw new Error(`Unable to contact PLC directory, response error ${response.status}`);
				}

				doc = await response.json();
			} else if (type === 'web') {
				if (!HOST_RE.test(ident)) {
					throw new Error(`Invalid did:web identifier: ${ident}`);
				}

				$status.textContent = `Contacting ${ident}...`;

				const response = await fetch(`https://${ident}/.well-known/did.json`, { signal: signal });

				if (response.status === 404) {
					throw new Error(`DID document not found`);
				} else if (!response.ok) {
					throw new Error(`Unable to retrieve DID document, response error ${response.status}`);
				}

				doc = await response.json();
			} else {
				throw new Error(`Unsupported DID type: ${type}`);
			}
		}

		const pds = getPdsEndpoint(doc);

		if (!pds) {
			throw new Error(`This user is not registered to any Bluesky PDS.`);
		}

		// 3. Download and write the files...
		const writable = await fd.createWritable({ keepExistingData: false });

		try {
			// DID document
			{
				const entry = write_tar_entry({
					filename: 'did.json',
					data: JSON.stringify(doc),
				});

				await writable.write(entry);
			}

			// Data repository
			{
				$status.textContent = `Downloading repository`;

				const response = await fetch(`${pds}/xrpc/com.atproto.sync.getRepo?did=${did}`, { signal: signal });
				const body = response.body;

				if (!response.ok || !body) {
					throw new Error(`Failed to retrieve the export`);
				}

				const chunks: Uint8Array[] = [];

				let size = 0;
				let log = true;

				for await (const chunk of iterate_stream(body)) {
					size += chunk.length;
					chunks.push(chunk);

					// Rate-limit the text update
					if (log) {
						log = false;
						$status.textContent = `Downloading repository (${format_bytes(size)})`;

						setTimeout(() => (log = true), 500);
					}
				}

				const bytes = new Uint8Array(size);
				let offset = 0;

				for (let i = 0, il = chunks.length; i < il; i++) {
					const chunk = chunks[i];

					bytes.set(chunk, offset);
					offset += chunk.length;
				}

				const entry = write_tar_entry({
					filename: 'repo.car',
					data: bytes,
				});

				await writable.write(entry);
				signal.throwIfAborted();
			}

			// Blobs
			if (with_media) {
				$status.textContent = `Retrieving list of blobs`;

				const agent = new Agent({ serviceUri: pds });

				let done = 0;
				let cids: string[] = [];
				let cursor: string | undefined;

				do {
					const response = await agent.rpc.get('com.atproto.sync.listBlobs', {
						signal: signal,
						params: {
							did: did,
							cursor: cursor,
							limit: 1000,
						},
					});

					const data = response.data;

					cids = cids.concat(data.cids);
					cursor = data.cursor;

					$status.textContent = `Retrieving list of blobs... (${cids.length} found)`;
				} while (cursor != null);

				const total = cids.length;

				$status.textContent = `Downloading blobs`;

				await each_limit(cids, 2, async (cid) => {
					const segment = get_cid_segment(cid);

					let response: XRPCResponse<unknown>;

					while (true) {
						try {
							response = await agent.rpc.get('com.atproto.sync.getBlob', {
								signal: signal,
								params: {
									did: did,
									cid: cid,
								},
							});
						} catch (err) {
							if (err instanceof XRPCError) {
								// we got ratelimited, let's cool down
								if (err.status === ResponseType.RateLimitExceeded) {
									const rl_reset = err.headers?.['ratelimit-reset'];

									if (rl_reset !== undefined) {
										// `ratelimit-reset` is in unix
										const reset_date = +rl_reset * 1_000;
										const now = Date.now();

										// add one second just to be sure
										const delta = reset_date - now + 1_000;

										await sleep(delta);
										continue;
									}
								}
							}

							throw err;
						}

						break;
					}

					const entry = write_tar_entry({
						filename: `blobs/${segment}`,
						data: response.data as Uint8Array,
					});

					await writable.write(entry);

					$status.textContent = `Downloading blobs (${++done} of ${total})`;
				});
			}
		} finally {
			$status.textContent = `Finishing up`;
			await writable.close();
		}

		$status.textContent = `Data export finished`;
	}
}

customElements.define('export-data-form', ExportDataForm);

function get_cid_segment(cid: string) {
	// Use the first 8 characters as the bucket
	// Bluesky CIDs always starts with bafkrei (7 chars)
	const split = 8;

	return `${cid.slice(0, split)}/${cid.slice(split)}`;
	// return [cid.slice(0, split), cid.slice(8)] as const;
}

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function each_limit<T>(values: T[], limit: number, iterator: (value: T, index: number) => Promise<void>) {
	return new Promise<void>((res, rej) => {
		let active = 0;
		let current = 0;

		let fulfilled = false;

		const errors: any[] = [];

		const finish = () => {
			if (fulfilled || active > 0) {
				return;
			}

			fulfilled = true;

			if (errors.length > 0) {
				rej(new AggregateError(errors));
			} else {
				res();
			}
		};

		const resolve = () => {
			active--;
			run();
		};

		const reject = (err: any) => {
			active--;
			errors.push(err);
		};

		const run = () => {
			const c = current++;

			if (fulfilled) {
				return;
			}
			if (c >= values.length) {
				return finish();
			}

			const value = values[c];

			active++;

			try {
				const ret = iterator(value, c);

				if (ret && 'then' in ret) {
					ret.then(resolve, reject);
				} else {
					resolve();
				}
			} catch (err) {
				reject(err);
			}
		};

		for (let i = 0; i < limit; i++) {
			run();
		}
	});
}
