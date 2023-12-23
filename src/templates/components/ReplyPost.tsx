import type { Records } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../context.ts';
import { format_abs_date, format_abs_date_time } from '../intl/time.ts';
import { get_blob_url, get_post_url } from '../utils/url.ts';

import Embed from './Embed.tsx';
import RichTextRenderer from './RichTextRenderer.tsx';

export interface ReplyPostProps {
	rkey: string;
	post: Records['app.bsky.feed.post'];
	has_children: boolean;
	has_parent: boolean;
}

function ReplyPost({ rkey, post, has_children, has_parent }: ReplyPostProps) {
	const ctx = get_page_context();

	return (
		<div class="ReplyPost">
			<div class="ReplyPost__aside">
				<div class="ReplyPost__avatarContainer">
					{ctx.profile.avatar ? (
						<img loading="lazy" src={get_blob_url(ctx.profile.avatar)} class="ReplyPost__avatar" />
					) : null}
				</div>

				{has_children ? <div class="ReplyPost__hasChildrenLine"></div> : null}
				{has_parent ? <div class="ReplyPost__hasParentLine"></div> : null}
			</div>

			<div class="ReplyPost__main">
				<div class="ReplyPost__header">
					<span class="ReplyPost__nameContainer">
						{ctx.profile.displayName ? (
							<bdi class="ReplyPost__displayNameContainer">
								<span class="ReplyPost__displayName">{ctx.profile.displayName}</span>
							</bdi>
						) : (
							<span class="ReplyPost__handle">@{ctx.profile.handle}</span>
						)}
					</span>

					<span aria-hidden="true" class="ReplyPost__dot">
						·
					</span>

					<a
						href={get_post_url(rkey)}
						aria-label={format_abs_date_time(post.createdAt)}
						class="ReplyPost__datetime"
					>
						<time datetime={post.createdAt}>{format_abs_date(post.createdAt)}</time>
					</a>
				</div>

				<div class="ReplyPost__body">
					<RichTextRenderer text={post.text} facets={post.facets} />
				</div>

				{post.embed ? <Embed embed={post.embed} large={false} /> : null}
			</div>
		</div>
	);
}

export default ReplyPost;
