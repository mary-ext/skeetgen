import type { AtUri, Records } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../context.ts';

type PostRecord = Records['app.bsky.feed.post'];

export type PostTuple = [rkey: string, post: PostRecord];

export interface TimelineItem {
	uri: AtUri;
	rkey: string;
	post: PostRecord;
}

export interface TimelineSlice {
	items: TimelineItem[];
}

function is_next_in_slice(slice: TimelineSlice, item: TimelineItem) {
	const items = slice.items;
	const last = items[items.length - 1];

	const reply = item.post.reply;
	return reply !== undefined && last.uri === reply.parent.uri;
}
function is_first_in_slice(slice: TimelineSlice, item: TimelineItem) {
	const items = slice.items;
	const first = items[0];

	const reply = first.post.reply;
	return reply !== undefined && reply.parent.uri === item.uri;
}

export function create_timeline_slices(arr: PostTuple[]) {
	const ctx = get_page_context();
	const did = ctx.profile.did;

	const slices: TimelineSlice[] = [];
	let jlen = 0;

	loop: for (let i = arr.length - 1; i >= 0; i--) {
		const [rkey, post] = arr[i];

		const item: TimelineItem = {
			uri: `at://${did}/app.bsky.feed.post/${rkey}`,
			rkey: rkey,
			post: post,
		};

		// if we find a matching slice and it's currently not in front, then bump
		// it to the front. this is so that new reply don't get buried away because
		// there's multiple posts separating it and the parent post.
		for (let j = 0; j < jlen; j++) {
			const slice = slices[j];

			if (is_first_in_slice(slice, item)) {
				slice.items.unshift(item);

				if (j !== 0) {
					slices.splice(j, 1);
					slices.unshift(slice);
				}

				continue loop;
			} else if (is_next_in_slice(slice, item)) {
				slice.items.push(item);

				if (j !== 0) {
					slices.splice(j, 1);
					slices.unshift(slice);
				}

				continue loop;
			}
		}

		slices.unshift({ items: [item] });
		jlen++;
	}

	return slices;
}
