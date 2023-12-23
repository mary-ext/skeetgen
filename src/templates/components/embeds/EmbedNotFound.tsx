import type { DID } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../../context.ts';
import { get_bsky_app_url, get_collection_ns, get_repo_id } from '../../utils/url.ts';

export interface EmbedNotFoundProps {
	uri: string;
}

const COLLECTION_LABELS: Record<string, string> = {
	'app.bsky.feed.post': 'post',
	'app.bsky.feed.generator': 'feed',
	'app.bsky.graph.list': 'list',
};

function EmbedNotFound({ uri }: EmbedNotFoundProps) {
	const ctx = get_page_context();

	const repo = get_repo_id(uri) as DID;
	const ns = get_collection_ns(uri);

	const ns_label = ns in COLLECTION_LABELS ? COLLECTION_LABELS[ns] : `record (${ns})`;

	return (
		<div class="EmbedNotFound">
			{repo === ctx.profile.did ? (
				<p class="EmbedNotFound__self">This {ns_label} may have been deleted</p>
			) : (
				<>
					<p class="EmbedNotFound__other">This is a {ns_label} by another user.</p>
					<a href={get_bsky_app_url(uri)} target="_blank" class="Link">
						View in bsky.app
					</a>
				</>
			)}
		</div>
	);
}

export default EmbedNotFound;
