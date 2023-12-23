import type { Records, RefOf } from '@externdefs/bluesky-client/atp-schema';

import { get_blob_str } from '../../context.ts';
import { get_blob_url } from '../../utils/url.ts';

type ListPurpose = RefOf<'app.bsky.graph.defs#listPurpose'>;
const LIST_PURPOSE_LABELS: Record<ListPurpose, string> = {
	'app.bsky.graph.defs#modlist': 'Moderation list',
	'app.bsky.graph.defs#curatelist': 'Curation list',
};

export interface EmbedListProps {
	record: Records['app.bsky.graph.list'];
}

function EmbedList({ record }: EmbedListProps) {
	const raw_purpose = record.purpose;
	const purpose = raw_purpose in LIST_PURPOSE_LABELS ? LIST_PURPOSE_LABELS[raw_purpose] : raw_purpose;

	return (
		<div class="EmbedList">
			<div class="EmbedList__avatarContainer">
				{record.avatar ? (
					<img loading="lazy" src={get_blob_url(get_blob_str(record.avatar))} class="EmbedList__avatar" />
				) : null}
			</div>

			<div class="EmbedList__main">
				<p class="EmbedList__name">{record.name}</p>
				<p class="EmbedList__type">{purpose}</p>
			</div>
		</div>
	);
}

export default EmbedList;
