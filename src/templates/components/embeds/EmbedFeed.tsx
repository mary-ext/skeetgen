import type { Records } from '@externdefs/bluesky-client/atp-schema';

import { get_blob_str } from '../../context.ts';
import { get_blob_url } from '../../utils/url.ts';

export interface EmbedFeedProps {
	record: Records['app.bsky.feed.generator'];
}

function EmbedFeed({ record }: EmbedFeedProps) {
	return (
		<div class="EmbedFeed">
			<div class="EmbedFeed__avatarContainer">
				{record.avatar ? (
					<img loading="lazy" src={get_blob_url(get_blob_str(record.avatar))} class="EmbedFeed__avatar" />
				) : null}
			</div>

			<div class="EmbedFeed__main">
				<p class="EmbedFeed__name">{record.displayName}</p>
				<p class="EmbedFeed__type">Feed</p>
			</div>
		</div>
	);
}

export default EmbedFeed;
