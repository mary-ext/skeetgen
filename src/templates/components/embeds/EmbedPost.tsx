import type { Records } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../../context.ts';
import { format_abs_date } from '../../intl/time.ts';
import { get_blob_url, get_post_url } from '../../utils/url.ts';

import EmbedImage from './EmbedImage.tsx';

type PostRecord = Records['app.bsky.feed.post'];

export interface EmbedPostProps {
	rkey: string;
	record: PostRecord;
	large: boolean;
}

function EmbedPost({ rkey, record, large }: EmbedPostProps) {
	const ctx = get_page_context();

	const text = record.text;
	const images = get_post_images(record);

	const show_large_images = images !== undefined && (large || !text);

	return (
		<a href={get_post_url(rkey)} class="EmbedPost Interactive">
			<div class="EmbedPost__header">
				<div class="EmbedPost__avatarContainer">
					{ctx.profile.avatar ? (
						<img loading="lazy" src={get_blob_url(ctx.profile.avatar)} class="EmbedPost__avatar" />
					) : null}
				</div>

				<span class="EmbedPost__nameContainer">
					{ctx.profile.displayName ? (
						<bdi class="EmbedPost__displayNameContainer">
							<span class="EmbedPost__displayName">{ctx.profile.displayName}</span>
						</bdi>
					) : (
						<span class="EmbedPost__handle">@{ctx.profile.handle}</span>
					)}
				</span>

				<span aria-hidden="true" class="EmbedPost__dot">
					·
				</span>

				<span class="EmbedPost__date">{format_abs_date(record.createdAt)}</span>
			</div>

			{text ? (
				<div class="EmbedPost__body">
					{images && !large ? (
						<div class="EmbedPost__imageAside">
							<EmbedImage images={images} is_bordered={true} allow_standalone_ratio={false} />
						</div>
					) : null}

					<div class="EmbedPost__text">{text}</div>
				</div>
			) : null}

			{show_large_images ? (
				<>
					{text ? <div class="EmbedPost__divider"></div> : null}
					<EmbedImage images={images} is_bordered={false} allow_standalone_ratio={false} />
				</>
			) : null}
		</a>
	);
}

export default EmbedPost;

function get_post_images(post: PostRecord) {
	const embed = post.embed;

	if (embed) {
		const $type = embed.$type;

		if ($type === 'app.bsky.embed.images') {
			return embed.images;
		} else if ($type === 'app.bsky.embed.recordWithMedia') {
			const media = embed.media;

			if (media.$type === 'app.bsky.embed.images') {
				return media.images;
			}
		}
	}
}
