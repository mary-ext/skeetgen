import { type FileSystemFileHandle, showSaveFilePicker } from 'native-file-system-adapter';

import type { DidDocument } from '@externdefs/bluesky-client/agent';
import type { DID, Records } from '@externdefs/bluesky-client/atp-schema';

import { CarBlockIterator } from '@ipld/car';
import { decode as decode_cbor } from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';

import { target } from '../utils/controller.ts';
import { assert, create_iterable_reader, iterate_stream } from '../utils/misc.ts';
import { untar, write_tar_entry } from '../utils/tar.ts';

import { type BaseContext, get_blob_str, render_page } from '../templates/context.ts';
import { create_posts_graph } from '../templates/utils/posts.ts';
import { get_tid_segment } from '../templates/utils/url.ts';
import { chunked } from '../templates/utils/misc.ts';

import { SearchPage } from '../templates/pages/SearchPage.tsx';
import { ThreadPage } from '../templates/pages/ThreadPage.tsx';
import { TimelinePage } from '../templates/pages/TimelinePage.tsx';
import { WelcomePage } from '../templates/pages/WelcomePage.tsx';

const supports_fsa = 'showDirectoryPicker' in globalThis;

type PostRecord = Records['app.bsky.feed.post'];
type ProfileRecord = Records['app.bsky.actor.profile'];

const decoder = new TextDecoder();

class GenerateArchiveForm extends HTMLElement {
	private form = target<HTMLFormElement>(this, 'form');
	private status = target<HTMLParagraphElement>(this, 'status');

	private picker_input = target<HTMLInputElement>(this, 'picker_input');
	private picker_label = target<HTMLSpanElement>(this, 'picker_label');

	private fsa_large_warning = target<HTMLDivElement>(this, 'fsa_large_warning');

	connectedCallback() {
		{
			const $picker_input = this.picker_input.get()!;
			const $picker_label = this.picker_label.get()!;

			const $fsa_large_warning = this.fsa_large_warning.get()!;

			$picker_input.addEventListener('input', () => {
				const files = $picker_input.files!;
				const file = files.length > 0 ? files[0] : undefined;

				$picker_label.textContent = file ? `${file.name}` : `No file selected.`;
				$fsa_large_warning.style.display = !supports_fsa && file && file.size > 1e7 ? '' : `none`;
			});
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
				const archive = data.get('archive') as File;
				const with_media = !!data.get('with_media');

				const signal = controller.signal;

				$status.textContent = '';
				$status.classList.remove('text-red-500');
				$status.classList.add('opacity-50');

				const date = new Date().toISOString();

				const promise = showSaveFilePicker({
					suggestedName: `${date}-archive.tar`,

					// @ts-expect-error - not sure why the polyfill isn't typed correctly.
					id: 'skeetgen-archive',
					startIn: 'downloads',
					types: [
						{
							description: 'TAR archive',
							accept: { 'application/x-tar': ['.tar'] },
						},
					],
				});

				promise.then((fd: FileSystemFileHandle) => {
					if (signal.aborted) {
						return;
					}

					this.generate_archive(signal, fd, archive, with_media).then(
						() => {
							// If we got here, we're still dealing with our own controller.
							controller!.abort();
						},
						(err) => {
							if (signal.aborted) {
								return;
							}

							console.error(err);

							$status.textContent = err.message;
							$status.classList.add('text-red-500');
							$status.classList.remove('opacity-50');
						},
					);
				});
			});
		}
	}

	async generate_archive(signal: AbortSignal, fd: FileSystemFileHandle, archive: Blob, with_media: boolean) {
		const $status = this.status.get()!;

		let did: DidDocument;
		let profile: ProfileRecord | undefined;

		const feeds = new Map<string, Records['app.bsky.feed.generator']>();
		const lists = new Map<string, Records['app.bsky.graph.list']>();
		const posts = new Map<string, PostRecord>();
		const threadgates = new Map<string, Records['app.bsky.feed.threadgate']>();

		// 1. Retrieve posts from the archive
		{
			let car_buf: Uint8Array | undefined;
			let did_buf: Uint8Array | undefined;

			$status.textContent = `Reading archive...`;

			// Grab the DID document and repository CAR from the archive.
			{
				// Slice the archive so we can read it again for later.
				const stream = (with_media ? archive.slice() : archive).stream();
				const reader = create_iterable_reader(iterate_stream(stream));

				for await (const entry of untar(reader)) {
					if (entry.name === 'repo.car') {
						car_buf = new Uint8Array(entry.size);
						await entry.read(car_buf);
					}

					if (entry.name === 'did.json') {
						did_buf = new Uint8Array(entry.size);
						await entry.read(did_buf);
					}

					// Once we have these two there's no need to continue traversing
					if (car_buf !== undefined && did_buf !== undefined) {
						break;
					}
				}

				if (did_buf === undefined) {
					throw new Error(`did.json not found inside the archive`);
				}
				if (car_buf === undefined) {
					throw new Error(`repo.car not found inside the archive`);
				}
			}

			// Read the DID file
			{
				const doc_str = decoder.decode(did_buf);

				try {
					did = JSON.parse(doc_str) as DidDocument;
				} catch (err) {
					throw new Error(`failed to read did document`, { cause: err });
				}
			}

			// Read the car file
			{
				const car = await CarBlockIterator.fromBytes(car_buf);

				const roots = await car.getRoots();
				assert(roots.length === 1, `expected 1 root commit`);

				const root_cid = roots[0];
				const blockmap: BlockMap = new Map();

				for await (const { cid, bytes } of car) {
					// await verify_cid_for_bytes(cid, bytes);
					blockmap.set(cid.toString(), bytes);
				}

				signal.throwIfAborted();

				const commit = read_obj(blockmap, root_cid) as Commit;

				for (const { key, cid } of walk_entries(blockmap, commit.data)) {
					const [collection, rkey] = key.split('/');

					if (collection === 'app.bsky.feed.post') {
						const record = read_obj(blockmap, cid) as PostRecord;
						posts.set(rkey, record);
					} else if (collection === 'app.bsky.actor.profile') {
						const record = read_obj(blockmap, cid) as ProfileRecord;
						profile = record;
					} else if (collection === 'app.bsky.feed.generator') {
						const record = read_obj(blockmap, cid) as Records['app.bsky.feed.generator'];
						feeds.set(rkey, record);
					} else if (collection === 'app.bsky.graph.list') {
						const record = read_obj(blockmap, cid) as Records['app.bsky.graph.list'];
						lists.set(rkey, record);
					} else if (collection === 'app.bsky.feed.threadgate') {
						const record = read_obj(blockmap, cid) as Records['app.bsky.feed.threadgate'];
						threadgates.set(rkey, record);
					}
				}
			}

			$status.textContent = `Retrieved ${posts.size} posts`;
		}

		// 3. Generate pages
		const writable = await fd.createWritable({ keepExistingData: false });

		try {
			let base_context: BaseContext;

			// Set up the necessary context for rendering pages
			{
				const handles = did.alsoKnownAs?.filter((uri) => uri.startsWith('at://')).map((uri) => uri.slice(5));

				base_context = {
					posts_dir: '/posts',
					blob_dir: `/blobs`,
					asset_dir: `/assets`,

					records: {
						feeds: feeds,
						lists: lists,
						posts: posts,
						threadgates: threadgates,
					},
					post_graph: create_posts_graph(did.id as DID, posts),

					profile: {
						did: did.id as DID,
						handle: handles && handles.length > 0 ? handles[0] : 'handle.invalid',
						displayName: profile?.displayName?.trim(),
						avatar: profile?.avatar && get_blob_str(profile?.avatar),
					},
				};
			}

			// Render individual threads
			{
				signal.throwIfAborted();
				$status.textContent = `Rendering threads`;

				for (const [rkey, post] of posts) {
					const segment = get_tid_segment(rkey);

					await writable.write(
						write_tar_entry({
							filename: `posts/${segment}.html`,
							data: render_page({
								context: {
									...base_context,
									path: `/posts/${segment}.html`,
								},
								render: () => {
									return ThreadPage({ post: post, rkey: rkey });
								},
							}),
						}),
					);
				}
			}

			// Render timelines
			{
				signal.throwIfAborted();
				$status.textContent = `Rendering timelines`;

				const post_tuples = [...posts];

				// We want the posts to be sorted by newest-first
				{
					const collator = new Intl.Collator('en-US');
					post_tuples.sort((a, b) => collator.compare(b[0], a[0]));
				}

				// All posts
				{
					await write_timeline_pages('with_replies', post_tuples);
				}

				// Root posts only
				{
					const root_posts = post_tuples.filter(([, post]) => post.reply === undefined);
					await write_timeline_pages('posts', root_posts);
				}

				// Image posts only
				{
					const media_posts = post_tuples.filter(([, post]) => {
						const embed = post.embed;

						return (
							embed !== undefined &&
							(embed.$type === 'app.bsky.embed.images' ||
								(embed.$type === 'app.bsky.embed.recordWithMedia' &&
									embed.media.$type === 'app.bsky.embed.images'))
						);
					});

					await write_timeline_pages('media', media_posts);
				}
			}

			// Render search page
			{
				signal.throwIfAborted();
				$status.textContent = `Writing search page`;

				await writable.write(
					write_tar_entry({
						filename: `search.html`,
						data: render_page({
							context: {
								...base_context,
								path: `/search.html`,
							},
							render: () => {
								return SearchPage({});
							},
						}),
					}),
				);
			}

			// Render other pages
			{
				signal.throwIfAborted();
				$status.textContent = `Writing remaining pages`;

				await writable.write(
					write_tar_entry({
						filename: `index.html`,
						data: render_page({
							context: {
								...base_context,
								path: `/index.html`,
							},
							render: () => {
								return WelcomePage({});
							},
						}),
					}),
				);
			}

			// Copy the necessary assets
			{
				signal.throwIfAborted();
				$status.textContent = `Downloading necessary assets`;

				await writable.write(
					write_tar_entry({
						filename: 'assets/style.css',
						data: await get_asset('archive_assets/style.css', signal),
					}),
				);

				await writable.write(
					write_tar_entry({
						filename: 'assets/search.js',
						data: await get_asset('archive_assets/search.js', signal),
					}),
				);
			}

			// Copy all the blobs over, if requested
			if (with_media) {
				signal.throwIfAborted();
				$status.textContent = `Copying media files`;

				let log = true;
				let count = 0;

				const stream = (with_media ? archive.slice() : archive).stream();
				const reader = create_iterable_reader(iterate_stream(stream));

				for await (const entry of untar(reader)) {
					if (entry.name.startsWith('blobs/')) {
						signal.throwIfAborted();

						const buffer = new Uint8Array(entry.size);

						await entry.read(buffer);
						await writable.write(write_tar_entry({ filename: entry.name, data: buffer }));

						count++;

						if (log) {
							log = false;
							$status.textContent = `Copying media files (${count} copied)`;

							setTimeout(() => (log = true), 500);
						}
					}
				}
			}

			async function get_asset(url: string, signal: AbortSignal) {
				const response = await fetch(import.meta.env.BASE_URL + url, { signal: signal });

				if (!response.ok) {
					throw new Error(`Failed to retrieve ${url}`);
				}

				const buffer = await response.arrayBuffer();

				return buffer;
			}

			async function write_timeline_pages(
				type: 'posts' | 'with_replies' | 'media',
				tuples: [rkey: string, post: PostRecord][],
			) {
				const pages = chunked(tuples, 50);

				// Push an empty page
				if (pages.length === 0) {
					pages.push([]);
				}

				for (let i = 0, ilen = pages.length; i < ilen; i++) {
					const page = pages[i];

					await writable.write(
						write_tar_entry({
							filename: `timeline/${type}/${i + 1}.html`,
							data: render_page({
								context: {
									...base_context,
									path: `/timeline/${type}/${i + 1}.html`,
								},
								render: () => {
									return TimelinePage({
										type: type,
										current_page: i + 1,
										total_pages: ilen,
										posts: page,
									});
								},
							}),
						}),
					);
				}
			}

			$status.textContent = `Waiting for writes to finish`;
			await writable.close();
		} catch (err) {
			$status.textContent = `Aborting`;
			await writable.abort(err);

			throw err;
		}

		$status.textContent = `Archive generation finished`;
	}
}

customElements.define('generate-archive-form', GenerateArchiveForm);

type BlockMap = Map<string, Uint8Array>;

interface Commit {
	version: 3;
	did: string;
	data: CID;
	rev: string;
	prev: CID | null;
	sig: Uint8Array;
}

interface TreeEntry {
	/** count of bytes shared with previous TreeEntry in this Node (if any) */
	p: number;
	/** remainder of key for this TreeEntry, after "prefixlen" have been removed */
	k: Uint8Array;
	/** link to a sub-tree Node at a lower level which has keys sorting after this TreeEntry's key (to the "right"), but before the next TreeEntry's key in this Node (if any) */
	v: CID;
	/** next subtree (to the right of leaf) */
	t: CID | null;
}

interface MstNode {
	/** link to sub-tree Node on a lower level and with all keys sorting before keys at this node */
	l: CID | null;
	/** ordered list of TreeEntry objects */
	e: TreeEntry[];
}

interface NodeEntry {
	key: string;
	cid: CID;
}

function* walk_entries(map: BlockMap, pointer: CID): Generator<NodeEntry> {
	const data = read_obj(map, pointer) as MstNode;
	const entries = data.e;

	let last_key = '';

	if (data.l !== null) {
		yield* walk_entries(map, data.l);
	}

	for (let i = 0, il = entries.length; i < il; i++) {
		const entry = entries[i];

		const key_str = decoder.decode(entry.k);
		const key = last_key.slice(0, entry.p) + key_str;

		last_key = key;

		yield { key: key, cid: entry.v };

		if (entry.t !== null) {
			yield* walk_entries(map, entry.t);
		}
	}
}

// async function verify_cid_for_bytes(cid: CID, bytes: Uint8Array) {
// 	const digest = await mf_sha256.digest(bytes);
// 	const expected = CID.createV1(cid.code, digest);

// 	if (!cid.equals(expected)) {
// 		throw new Error(`Invalid CID, expected ${expected} but got ${cid}`);
// 	}
// }

function read_obj(map: Map<string, Uint8Array>, cid: CID) {
	const bytes = map.get(cid.toString());
	assert(bytes != null, `cid not found`);

	const data = decode_cbor(bytes);

	return data;
}
