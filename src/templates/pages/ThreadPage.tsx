// page: posts/:rkey.html

import type { DID, Records } from '@externdefs/bluesky-client/atp-schema';
import { repeat, type JSXNode } from '@intrnl/jsx-to-string';

import { type PageContext, get_page_context, get_blob_str } from '../context.ts';
import {
	get_blob_url,
	get_bsky_app_url,
	get_collection_ns,
	get_post_url,
	get_record_key,
	get_repo_id,
} from '../utils/url.ts';

import type { EmbeddedImage, EmbeddedRecord } from '../utils/embed.ts';

import FeedPost from '../components/FeedPost.tsx';
import Page from '../components/Page.tsx';
import PermalinkPost from '../components/PermalinkPost.tsx';
import ReplyTree from '../components/ReplyTree.tsx';

type PostRecord = Records['app.bsky.feed.post'];

interface ThreadPageProps {
	rkey: string;
	post: PostRecord;
}

const MAX_ANCESTORS = 6;

const enum ExternalReply {
	// Top-most post isn't linking to a reply
	NO,
	// Top-most post is replying to own post, but it no longer exists.
	SAME_USER,
	// Top-most post is linking to another user.
	YES,
}

export function ThreadPage({ rkey, post }: ThreadPageProps) {
	const ctx = get_page_context();

	let top_post = post;
	let top_rkey = rkey;

	let ancestors: [rkey: string, post: PostRecord][] = [];
	let children: [rkey: string, post: PostRecord][] = [];

	let reply_state = ExternalReply.NO;
	let root_rkey: string | undefined;
	let is_ancestor_overflowing = false;

	{
		const graph = ctx.post_graph;

		const entry = graph.get(rkey);
		if (entry !== undefined) {
			const posts = ctx.records.posts;

			// Collect children replies to this post
			{
				const descendants = entry.descendants;

				for (let i = 0, ilen = descendants.length; i < ilen; i++) {
					const child_rkey = descendants[i];
					const child_post = posts.get(child_rkey);

					if (child_post !== undefined) {
						children.push([child_rkey, child_post]);
					}
				}
			}

			// Collect parent replies to this post
			{
				let parent_rkey: string | null | undefined = entry.ancestor;
				let count = 0;

				while (parent_rkey != null && !is_ancestor_overflowing) {
					const parent_post = posts.get(parent_rkey);
					if (parent_post === undefined) {
						break;
					}

					top_rkey = parent_rkey;
					top_post = parent_post;
					is_ancestor_overflowing = ++count >= MAX_ANCESTORS;

					ancestors.unshift([parent_rkey, parent_post]);

					const parent_entry = graph.get(parent_rkey);
					parent_rkey = parent_entry?.ancestor;
				}
			}
		}
	}

	// Check if the top-most post contains a reply
	{
		const reply = top_post.reply;

		if (reply !== undefined) {
			const our_did = ctx.profile.did;

			{
				const parent_uri = reply.parent.uri;
				const repo = get_repo_id(parent_uri);

				reply_state = repo === our_did ? ExternalReply.SAME_USER : ExternalReply.YES;
			}

			{
				const root_uri = reply.root.uri;
				const repo = get_repo_id(root_uri) as DID;
				const rkey = get_record_key(root_uri);

				if (repo === our_did && ctx.records.posts.has(rkey)) {
					root_rkey = rkey;
				}
			}
		}
	}

	return (
		<Page title={get_title(ctx, post)} head={get_embed_head(ctx, post)}>
			{ancestors.length > 0 || reply_state !== ExternalReply.NO ? (
				<details class="ThreadAncestors">
					<summary class="Interactive ThreadAncestors__header">
						<svg class="ThreadAncestors__accordionIcon" viewBox="0 0 24 24">
							<path fill="currentColor" d="M10 6L8.59 7.41L13.17 12l-4.58 4.59L10 18l6-6z" />
						</svg>

						<span class="ThreadAncestors__accordionText">Show parent replies</span>
					</summary>

					<div class="ThreadAncestors__list">
						{is_ancestor_overflowing || reply_state !== ExternalReply.NO ? (
							<div class="ThreadCut">
								<div class="ThreadCut__aside">
									<div class="ThreadCut__line"></div>
								</div>
								<div class="ThreadCut__main">
									{is_ancestor_overflowing ? (
										<a href={get_post_url(top_rkey)} class="Link">
											View parent reply
										</a>
									) : (
										<>
											<p class="ThreadCut__headerText">
												{reply_state === ExternalReply.SAME_USER
													? `This post has been deleted`
													: `The post below is a reply to another user`}
											</p>

											<div class="ThreadCut__actions">
												{reply_state !== ExternalReply.SAME_USER ? (
													<a
														href={get_bsky_app_url(`at://${ctx.profile.did}/app.bsky.feed.post/${top_rkey}`)}
														target="_blank"
														class="Link"
													>
														view in bsky.app
													</a>
												) : null}

												{reply_state !== ExternalReply.SAME_USER && root_rkey ? (
													<span aria-hidden="true" class="ThreadCut__actionSeparator">
														|
													</span>
												) : null}

												{root_rkey ? (
													<a href={get_post_url(root_rkey)} class="Link">
														view root post
													</a>
												) : null}
											</div>
										</>
									)}
								</div>
							</div>
						) : null}

						{repeat(ancestors, ([parent_rkey, parent_post]) => (
							<FeedPost
								rkey={parent_rkey}
								post={parent_post}
								always_show_replies={false}
								has_prev={true}
								has_next={true}
							/>
						))}
					</div>
				</details>
			) : null}

			<PermalinkPost post={post} />

			<hr />

			<div class="ThreadPage__descendants">
				{repeat(children, ([child_rkey, child_post]) => (
					<ReplyTree rkey={child_rkey} post={child_post} depth={0} has_next={false} />
				))}
			</div>
		</Page>
	);
}

function get_title(ctx: PageContext, post: PostRecord): string {
	const author = ctx.profile;
	return `${author.displayName || `@${author.handle}`}: "${post.text}"`;
}

function get_embed_head(ctx: PageContext, post: PostRecord): JSXNode {
	const nodes: JSXNode = [];

	const embed = post.embed;
	const reply = post.reply;

	const profile = ctx.profile;
	const title = profile.displayName ? `${profile.displayName} (@${profile.handle})` : profile.handle;

	let header = '';
	let text = post.text;

	if (reply) {
		const parent_uri = reply.parent.uri;
		const repo = get_repo_id(parent_uri);

		if (repo === profile.did) {
			header += `[replying to self] `;
		} else {
			header += `[replying to ${repo}] `;
		}
	}

	if (embed) {
		const $type = embed.$type;

		let images: EmbeddedImage[] | undefined;
		let record: EmbeddedRecord | undefined;

		if ($type === 'app.bsky.embed.images') {
			images = embed.images;
		} else if ($type === 'app.bsky.embed.record') {
			record = embed.record;
		} else if ($type === 'app.bsky.embed.recordWithMedia') {
			const media = embed.media;

			record = embed.record.record;

			if (media.$type === 'app.bsky.embed.images') {
				images = images;
			}
		}

		if (images !== undefined) {
			const img = images[0];
			const url = get_blob_url(get_blob_str(img.image));

			nodes.push(
				<>
					<meta name="twitter:card" content="summary_large_image" />
					<meta property="og:image" content={url} />
				</>,
			);
		}

		if (record !== undefined) {
			const uri = record.uri;

			const repo = get_repo_id(uri);
			const ns = get_collection_ns(uri);

			if (ns === 'app.bsky.feed.post') {
				if (repo === profile.did) {
					header += `[quoting self] `;
				} else {
					header += `[quoting ${repo}] `;
				}
			}
		}
	}

	if (header) {
		text = `${header}\n\n${text}`;
	}

	nodes.push(
		<>
			<meta property="og:title" content={title} />
			<meta property="og:description" content={text} />
		</>,
	);

	return nodes;
}
