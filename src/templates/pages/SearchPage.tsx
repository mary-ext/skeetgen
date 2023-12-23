import { html } from '@intrnl/jsx-to-string';

import { get_page_context } from '../context.ts';
import { get_asset_url, get_tid_segment } from '../utils/url.ts';

import Page from '../components/Page.tsx';

export interface SearchPageProps {}

const enum PostFlags {
	HAS_EMBED_IMAGE = 1 << 0,
	HAS_EMBED_LINK = 1 << 1,
	HAS_EMBED_RECORD = 1 << 2,
	HAS_EMBED_FEED = 1 << 3,
	HAS_EMBED_LIST = 1 << 4,
}

type PostEntry = [rkey: string, text: string, ts: number, flag: number];

const is_nan = Number.isNaN;

export function SearchPage({}: SearchPageProps) {
	const ctx = get_page_context();
	const entries: PostEntry[] = [];

	{
		const posts = ctx.records.posts;

		for (const [rkey, post] of posts) {
			const text = post.text;

			if (!text.trim()) {
				continue;
			}

			const ts = new Date(post.createdAt).getTime();
			const is_ts_valid = !is_nan(ts);

			let flag = 0;

			{
				const embed = post.embed;
				if (embed !== undefined) {
					const $type = embed.$type;

					if ($type === 'app.bsky.embed.external') {
						flag |= PostFlags.HAS_EMBED_LINK;
					} else if ($type === 'app.bsky.embed.images') {
						flag |= PostFlags.HAS_EMBED_IMAGE;
					} else if ($type === 'app.bsky.embed.record') {
						flag |= PostFlags.HAS_EMBED_RECORD;
					} else if ($type === 'app.bsky.embed.recordWithMedia') {
						const $mediatype = embed.media.$type;

						flag |= PostFlags.HAS_EMBED_RECORD;

						if ($mediatype === 'app.bsky.embed.external') {
							flag |= PostFlags.HAS_EMBED_LINK;
						} else if ($mediatype === 'app.bsky.embed.images') {
							flag |= PostFlags.HAS_EMBED_IMAGE;
						}
					}
				}
			}

			entries.push([get_tid_segment(rkey), text, is_ts_valid ? ts : 0, flag]);
		}
	}

	return (
		<Page title={`Search @${ctx.profile.handle}'s posts`}>
			<div id="root">
				<noscript>
					<p class="SearchPage__noscript">This search page requires JavaScript to run.</p>
				</noscript>

				<p class="SearchPage__loading">Loading search, this might take a while.</p>
			</div>

			{/* Wrapping it in a <div hidden> should prevent layout/style recalcs for when we remove the <script> node */}
			<div hidden>
				<script id="search-json" type="application/json">
					{/* I'm gonna pull what's referred to as a "gamer move" */}
					{html(JSON.stringify(entries).replaceAll('</script>', '<\\/script>'))}
				</script>

				<script src={get_asset_url('search.js')}></script>
			</div>
		</Page>
	);
}
