import type { AtBlob, DID, Records, RefOf } from '@externdefs/bluesky-client/atp-schema';
import type { TrustedHTML } from '@intrnl/jsx-to-string';

import { CID } from 'multiformats/cid';

import type { PostGraphEntry } from './utils/posts.ts';

type PostRecord = Records['app.bsky.feed.post'];

let curr_context: PageContext | undefined;

export interface BaseContext {
	posts_dir: string;
	blob_dir: string;
	asset_dir: string;

	profile: RefOf<'app.bsky.actor.defs#profileViewBasic'>;

	records: {
		feeds: Map<string, Records['app.bsky.feed.generator']>;
		lists: Map<string, Records['app.bsky.graph.list']>;
		posts: Map<string, PostRecord>;
		threadgates: Map<string, Records['app.bsky.feed.threadgate']>;
	};

	post_graph: Map<string, PostGraphEntry>;
}

export interface PageContext extends BaseContext {
	path: string;
}

export interface RenderPageOptions {
	context: PageContext;
	render: () => TrustedHTML;
}

export function render_page({ context, render }: RenderPageOptions): string {
	const prev_context = curr_context;

	try {
		curr_context = context;
		return '<!doctype html>' + render().value;
	} finally {
		curr_context = prev_context;
	}
}

export function get_page_context(): PageContext {
	return curr_context!;
}

export function get_blob_str(blob: AtBlob) {
	// dag-cbor converted these links into CID objects, i'll figure them out later.
	const ref = blob.ref;

	if (ref instanceof CID) {
		return ref.toString();
	}

	return ref.$link;
}

export function is_did(str: DID): str is DID {
	return str.startsWith('did:');
}
