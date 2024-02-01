import { type FileSystemFileHandle, showSaveFilePicker } from 'native-file-system-adapter';
import map_promises from 'p-map';

import { type DidDocument, Agent, getPdsEndpoint } from '@externdefs/bluesky-client/agent';
import { type XRPCResponse, ResponseType, XRPCError } from '@externdefs/bluesky-client/xrpc-utils';

import { Logger } from '../utils/logger.tsx';

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
	private logger = target<HTMLDivElement>(this, 'logger');

	private fsa_warning = target<HTMLDivElement>(this, 'fsa_warning');

	private object_url: string | undefined;

	handle_before_unload = (ev: BeforeUnloadEvent) => {
		ev.preventDefault();
		ev.returnValue = true;
	};

	connectedCallback() {
		if (!supports_fsa) {
			const $fsa_warning = this.fsa_warning.get()!;
			$fsa_warning.style.display = '';
		}

		{
			const $form = this.form.get()!;

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

				const date = new Date().toISOString();

				const logger = new Logger(this.logger.get()!, signal);

				const promise = showSaveFilePicker({
					suggestedName: `${date}-${identifier}.tar`,

					// @ts-expect-error - not sure why the polyfill isn't typed correctly.
					id: 'bluesky-export',
					startIn: 'downloads',
					types: [
						{
							description: 'Tarball archive',
							accept: { 'application/x-tar': ['.tar'] },
						},
					],
				});

				promise.then((fd) => {
					if (signal.aborted) {
						return;
					}

					window.addEventListener('beforeunload', this.handle_before_unload);

					this.download_archive(signal, logger, fd, identifier, with_media).then(
						() => {
							window.removeEventListener('beforeunload', this.handle_before_unload);
						},
						(err) => {
							if (signal.aborted) {
								return;
							}

							window.removeEventListener('beforeunload', this.handle_before_unload);

							console.error(err);
							logger.error(err.message);
						},
					);
				});
			});
		}
	}

	async download_archive(
		signal: AbortSignal,
		logger: Logger,
		fd: FileSystemFileHandle,
		identifier: string,
		with_media: boolean,
	) {
		logger.log(`Data export started`);

		// 1. Resolve DID if it's not one
		let did: DID;
		{
			if (is_did(identifier)) {
				did = identifier;
			} else {
				using _progress = logger.progress(`Resolving ${identifier}`);

				const agent = new Agent({ serviceUri: APPVIEW_URL });

				const response = await agent.rpc.get('com.atproto.identity.resolveHandle', {
					signal: signal,
					params: {
						handle: identifier,
					},
				});

				did = response.data.did;
				logger.log(`Resolved @${identifier} to ${did}`);
			}
		}

		// 2. Retrieve the DID document
		let doc: DidDocument;
		{
			const [, type, ...rest] = did.split(':');
			const ident = rest.join(':');

			if (type === 'plc') {
				using _progress = logger.progress(`Contacting PLC directory`);

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

				using _progress = logger.progress(`Contacting ${ident}`);

				const response = await fetch(`https://${ident}/.well-known/did.json`, {
					mode: 'no-cors',
					signal: signal,
				});

				if (response.type === 'opaque') {
					throw new Error(`Unable to retrieve DID document due to CORS error`);
				}

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

		logger.log(`User is located on ${new URL(pds).hostname}`);

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
				using progress = logger.progress(`Downloading repository`);

				const response = await fetch(`${pds}/xrpc/com.atproto.sync.getRepo?did=${did}`, { signal: signal });
				const body = response.body;

				if (!response.ok || !body) {
					throw new Error(`Failed to retrieve the export`);
				}

				const chunks: Uint8Array[] = [];

				let size = 0;

				for await (const chunk of iterate_stream(body)) {
					size += chunk.length;
					chunks.push(chunk);

					if (!progress.ratelimited) {
						progress.update(`Downloading repository (${format_bytes(size)})`);
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
				const agent = new Agent({ serviceUri: pds });

				let done = 0;
				let cids: string[] = [];
				let cursor: string | undefined;

				{
					using progress = logger.progress(`Retrieving list of blobs`, null);
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

						progress.update(`Retrieving list of blobs (${cids.length} found)`);
					} while (cursor != null);
				}

				const total = cids.length;

				logger.log(`Found ${total} blobs to download`);

				{
					using progress = logger.progress(`Downloading blobs`);

					await map_promises(
						cids,
						async (cid) => {
							let response: XRPCResponse<unknown>;
							let fails = 0;

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
									if (signal.aborted) {
										return;
									}

									if (err instanceof XRPCError) {
										// we got ratelimited, let's cool down
										if (err.status === ResponseType.RateLimitExceeded) {
											const rl_reset = err.headers?.['ratelimit-reset'];

											if (rl_reset !== undefined) {
												logger.warn(`Ratelimit exceeded, waiting`);

												// `ratelimit-reset` is in unix
												const reset_date = +rl_reset * 1_000;
												const now = Date.now();

												// add one second just to be sure
												const delta = reset_date - now + 1_000;

												await sleep(delta);
												continue;
											}
										} else if (err.status === ResponseType.InvalidRequest) {
											if (err.message === 'Blob not found') {
												logger.warn(`Tried to download nonexistent blob\n${cid}`);
												return;
											}
										}
									}

									// Retry 2 times before failing entirely.
									if (++fails < 3) {
										continue;
									}

									throw err;
								}

								break;
							}

							const segment = get_cid_segment(cid);

							const entry = write_tar_entry({
								filename: `blobs/${segment}`,
								data: response.data as Uint8Array,
							});

							await writable.write(entry);

							progress.update(`Downloading blobs (${++done} of ${total})`);
						},
						{ concurrency: 2, signal: signal },
					);
				}
			}

			logger.log(`Finishing up`);
			await writable.close();
		} catch (err) {
			logger.log(`Aborting`);
			await writable.abort();

			throw err;
		}

		logger.log(`Data export finished`);
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
