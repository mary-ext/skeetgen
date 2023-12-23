import type { Records } from '@externdefs/bluesky-client/atp-schema';
import { repeat } from '@intrnl/jsx-to-string';

import { get_page_context } from '../context.ts';
import { get_post_url } from '../utils/url.ts';

import ReplyPost from './ReplyPost.tsx';

type PostRecord = Records['app.bsky.feed.post'];

export interface ReplyTreeProps {
	rkey: string;
	post: PostRecord;
	depth: number;
	has_next: boolean;
}

const MOBILE_DEPTH_LIMIT = 3;
const DESKTOP_DEPTH_LIMIT = 7;

function ReplyTree({ rkey, post, depth, has_next }: ReplyTreeProps) {
	const ctx = get_page_context();
	const children: [rkey: string, post: PostRecord][] = [];

	{
		const entry = ctx.post_graph.get(rkey);
		if (entry !== undefined) {
			const posts = ctx.records.posts;
			const descendants = entry.descendants;

			for (let i = 0, ilen = descendants.length; i < ilen; i++) {
				const child_rkey = descendants[i];
				const child_post = posts.get(child_rkey);

				if (child_post !== undefined) {
					children.push([child_rkey, child_post]);
				}
			}
		}
	}

	const render_children = () => {
		return repeat(children, ([child_rkey, child_post], index) => (
			<ReplyTree
				rkey={child_rkey}
				post={child_post}
				depth={depth + 1}
				has_next={index !== children.length - 1}
			/>
		));
	};

	const render_has_more = () => {
		return (
			<div class="ReplyTree__hasMore">
				<div class="ReplyTree__hasMoreLine"></div>

				<a href={get_post_url(rkey)} class="Link ReplyTree__hasMoreText">
					show {children.length} {children.length === 1 ? 'reply' : 'replies'}
				</a>
			</div>
		);
	};

	return (
		<div class="ReplyTree">
			{has_next ? <div class="ReplyTree__hasSiblingLine"></div> : null}

			<ReplyPost rkey={rkey} post={post} has_children={children.length > 0} has_parent={depth > 0} />

			{children.length > 0 && (
				<div class="ReplyTree__children">
					{depth >= DESKTOP_DEPTH_LIMIT ? (
						render_has_more()
					) : depth === MOBILE_DEPTH_LIMIT ? (
						// match exactly so that we only render this once
						<>
							<div class="ReplyTree__mobileOnly">{render_has_more()}</div>
							<div class="ReplyTree__desktopOnly">{render_children()}</div>
						</>
					) : (
						render_children()
					)}
				</div>
			)}
		</div>
	);
}

export default ReplyTree;
