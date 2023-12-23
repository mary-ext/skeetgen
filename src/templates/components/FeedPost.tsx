import type { Records } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../context.ts';
import { format_abs_date, format_abs_date_time } from '../intl/time.ts';
import { get_blob_url, get_post_url } from '../utils/url.ts';

import Embed from './Embed.tsx';
import RichTextRenderer from './RichTextRenderer.tsx';

type PostRecord = Records['app.bsky.feed.post'];

export interface FeedPost {
	rkey: string;
	post: PostRecord;
	/** Changes the condition for reply counter display from >1 to >0 */
	always_show_replies: boolean;
	/** Post is connected to a parent */
	has_prev: boolean;
	/** Draw a line connecting this post to the next */
	has_next: boolean;
}

function FeedPost({ rkey, post, always_show_replies, has_prev, has_next }: FeedPost) {
	const ctx = get_page_context();
	const href = get_post_url(rkey);

	let reply_count = 0;
	{
		const entry = ctx.post_graph.get(rkey);
		if (entry !== undefined) {
			reply_count = entry.descendants.length;
		}
	}

	return (
		<div class="FeedPost">
			<div class="FeedPost__context">
				{!has_prev && post.reply !== undefined ? (
					<div class="FeedPost__contextItem">
						<div class="FeedPost__contextLine"></div>
						<a href={href} class="FeedPost__contextText">
							Show full thread
						</a>
					</div>
				) : null}
			</div>

			<div class="FeedPost__content">
				<div class="FeedPost__aside">
					<div class="FeedPost__avatarContainer">
						{ctx.profile.avatar ? (
							<img loading="lazy" src={get_blob_url(ctx.profile.avatar)} class="FeedPost__avatar" />
						) : null}
					</div>

					{has_next ? <div class="FeedPost__hasNextLine"></div> : null}
				</div>

				<div class="FeedPost__main">
					<div class="FeedPost__header">
						<span class="FeedPost__nameContainer">
							{ctx.profile.displayName ? (
								<bdi class="FeedPost__displayNameContainer">
									<span class="FeedPost__displayName">{ctx.profile.displayName}</span>
								</bdi>
							) : (
								<span class="FeedPost__handle">@{ctx.profile.handle}</span>
							)}
						</span>

						<span aria-hidden="true" class="FeedPost__dot">
							·
						</span>

						<a href={href} aria-label={format_abs_date_time(post.createdAt)} class="FeedPost__date">
							<time datetime={post.createdAt}>{format_abs_date(post.createdAt)}</time>
						</a>
					</div>

					<div class="FeedPost__body">
						<RichTextRenderer text={post.text} facets={post.facets} />
					</div>

					{post.embed ? <Embed embed={post.embed} large={false} /> : null}

					{reply_count > (always_show_replies ? 0 : 1) && (
						<a href={href} class="Link FeedPost__replies">
							{reply_count} replies
						</a>
					)}
				</div>
			</div>
		</div>
	);
}

export default FeedPost;
