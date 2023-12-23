import type { DID, Records } from '@externdefs/bluesky-client/atp-schema';

import { get_record_key, get_repo_id } from './url.ts';

type PostRecord = Records['app.bsky.feed.post'];

export interface PostGraphEntry {
	ancestor: string | null;
	descendants: string[];
}

export function create_posts_graph(did: DID, posts: Map<string, PostRecord>) {
	const graph = new Map<string, PostGraphEntry>();

	for (const [rkey, post] of posts) {
		const parent_uri = post.reply?.parent.uri;

		if (!parent_uri) {
			continue;
		}

		const parent_repo = get_repo_id(parent_uri);
		const parent_rkey = get_record_key(parent_uri);

		if (parent_repo !== did) {
			continue;
		}

		// Add ourself to the parent entry
		{
			let parent_entry = graph.get(parent_rkey);
			if (parent_entry) {
				parent_entry.descendants.push(rkey);
			} else {
				graph.set(parent_rkey, { ancestor: null, descendants: [rkey] });
			}
		}

		// Now mark that down in our entry
		{
			let our_entry = graph.get(rkey);
			if (our_entry) {
				our_entry.ancestor = parent_rkey;
			} else {
				graph.set(rkey, { ancestor: parent_rkey, descendants: [] });
			}
		}
	}

	return graph;
}
