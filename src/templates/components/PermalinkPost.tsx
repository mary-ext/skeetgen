import type { Records } from '@externdefs/bluesky-client/atp-schema';
import { repeat } from '@intrnl/jsx-to-string';

import { get_page_context } from '../context.ts';
import { format_abs_date_time } from '../intl/time.ts';
import { get_blob_url } from '../utils/url.ts';

import Embed from './Embed.tsx';
import RichTextRenderer from './RichTextRenderer.tsx';

interface PermalinkPostProps {
	post: Records['app.bsky.feed.post'];
}

function PermalinkPost({ post }: PermalinkPostProps) {
	const ctx = get_page_context();

	return (
		<div class="PermalinkPost">
			<div class="PermalinkPost__header">
				<div class="PermalinkPost__avatarContainer">
					{ctx.profile.avatar ? (
						<img loading="lazy" src={get_blob_url(ctx.profile.avatar)} class="PermalinkPost__avatar" />
					) : null}
				</div>

				<span class="PermalinkPost__nameContainer">
					<bdi class="PermalinkPost__displayNameContainer">
						<span class="PermalinkPost__displayName">{ctx.profile.displayName}</span>
					</bdi>
					<span class="PermalinkPost__handle">@{ctx.profile.handle}</span>
				</span>
			</div>

			<div class="PermalinkPost__body">
				<RichTextRenderer text={post.text} facets={post.facets} />
			</div>

			{post.embed ? <Embed embed={post.embed} large={true} /> : null}

			{post.tags ? (
				<div class="PermalinkPost__tags">
					{repeat(post.tags, (tag) => (
						<div class="PermalinkPost__tag">
							<span>#</span>
							<span class="PermalinkPost__tagText">{tag}</span>
						</div>
					))}
				</div>
			) : null}

			<div class="PermalinkPost__footer">
				<time datetime={post.createdAt} class="PermalinkPost__date">
					{format_abs_date_time(post.createdAt)}
				</time>
			</div>
		</div>
	);
}

export default PermalinkPost;
