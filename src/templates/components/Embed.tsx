import type { Records } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../context.ts';
import { get_collection_ns, get_record_key, get_repo_id } from '../utils/url.ts';

import type { EmbeddedImage, EmbeddedLink, EmbeddedRecord } from '../utils/embed.ts';

import EmbedFeed from './embeds/EmbedFeed.tsx';
import EmbedImage from './embeds/EmbedImage.tsx';
import EmbedLink from './embeds/EmbedLink.tsx';
import EmbedList from './embeds/EmbedList.tsx';
import EmbedNotFound from './embeds/EmbedNotFound.tsx';
import EmbedPost from './embeds/EmbedPost.tsx';

type PostRecord = Records['app.bsky.feed.post'];

export interface EmbedProps {
	embed: NonNullable<PostRecord['embed']>;
	large: boolean;
}

function Embed({ embed, large }: EmbedProps) {
	let images: EmbeddedImage[] | undefined;
	let link: EmbeddedLink | undefined;
	let record: EmbeddedRecord | undefined;

	{
		const $type = embed.$type;

		if ($type == 'app.bsky.embed.external') {
			link = embed.external;
		} else if ($type === 'app.bsky.embed.images') {
			images = embed.images;
		} else if ($type === 'app.bsky.embed.record') {
			record = embed.record;
		} else if ($type === 'app.bsky.embed.recordWithMedia') {
			const rec = embed.record.record;

			const media = embed.media;
			const mediatype = media.$type;

			record = rec;

			if (mediatype === 'app.bsky.embed.external') {
				link = media.external;
			} else if (mediatype === 'app.bsky.embed.images') {
				images = media.images;
			}
		}
	}

	return (
		<div class="Embed">
			{link ? <EmbedLink link={link} /> : null}
			{images ? <EmbedImage images={images} is_bordered={true} allow_standalone_ratio={true} /> : null}
			{record ? render_record(record, large) : null}
		</div>
	);
}

export default Embed;

function render_record(record: EmbeddedRecord, large: boolean) {
	const { profile, records } = get_page_context();

	const uri = record.uri;

	const ns = get_collection_ns(uri);
	const rkey = get_record_key(uri);

	const is_same_author = get_repo_id(uri) === profile.did;

	if (ns === 'app.bsky.feed.post') {
		if (is_same_author) {
			const post = records.posts.get(rkey);

			if (post !== undefined) {
				return <EmbedPost rkey={rkey} record={post} large={large} />;
			}
		}

		return <EmbedNotFound uri={uri} />;
	}

	if (ns === 'app.bsky.feed.generator') {
		if (is_same_author) {
			const feed = records.feeds.get(rkey);

			if (feed !== undefined) {
				return <EmbedFeed record={feed} />;
			}
		}

		return <EmbedNotFound uri={uri} />;
	}

	if (ns === 'app.bsky.graph.list') {
		if (is_same_author) {
			const list = records.lists.get(rkey);

			if (list !== undefined) {
				return <EmbedList record={list} />;
			}
		}

		return <EmbedNotFound uri={uri} />;
	}

	return null;
}
