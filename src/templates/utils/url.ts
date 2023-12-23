import type { AtUri } from '@externdefs/bluesky-client/atp-schema';

import { get_page_context } from '../context.ts';
import { get_dirname, join_path, relative_path } from './path.ts';

export function get_record_key(uri: AtUri) {
	const idx = uri.lastIndexOf('/');
	return uri.slice(idx + 1);
}

export function get_collection_ns(uri: AtUri) {
	const first = uri.indexOf('/', 5);
	const second = uri.indexOf('/', first + 1);

	return uri.slice(first + 1, second);
}

export function get_repo_id(uri: AtUri) {
	const idx = uri.indexOf('/', 5);
	return uri.slice(5, idx);
}

export function get_bsky_app_url(uri: AtUri) {
	const repo = get_repo_id(uri);
	const ns = get_collection_ns(uri);
	const rkey = get_record_key(uri);

	if (ns === 'app.bsky.feed.post') {
		return `https://bsky.app/profile/${repo}/post/${rkey}`;
	}

	if (ns === 'app.bsky.feed.generator') {
		return `https://bsky.app/profile/${repo}/feed/${rkey}`;
	}

	if (ns === 'app.bsky.graph.list') {
		return `https://bsky.app/profile/${repo}/lists/${rkey}`;
	}

	if (ns === 'app.bsky.actor.profile') {
		return `https://bsky.app/profile/${repo}`;
	}

	throw new Error(`unsupported uri: ${uri}`);
}

export function get_tid_segment(rkey: string) {
	// Use whatever's left after removing the last 10 characters as the bucket.
	const split = -10;

	return `${rkey.slice(0, split)}/${rkey.slice(split)}`;
}

export function get_cid_segment(cid: string) {
	// Use the first 8 characters as the bucket
	// Bluesky CIDs always starts with bafkrei (7 chars)
	const split = 8;

	return `${cid.slice(0, split)}/${cid.slice(split)}`;
}

export function get_relative_url(url: string) {
	const ctx = get_page_context();

	return relative_path(get_dirname(ctx.path), url);
}

export function get_asset_url(asset: string) {
	const ctx = get_page_context();

	return get_relative_url(join_path(ctx.asset_dir, asset));
}

export function get_blob_url(cid: string) {
	const ctx = get_page_context();
	const segment = get_cid_segment(cid);

	return get_relative_url(join_path(ctx.blob_dir, `${segment}`));
}

export function get_post_url(rkey: string) {
	const ctx = get_page_context();
	const segment = get_tid_segment(rkey);

	return get_relative_url(join_path(ctx.posts_dir, `${segment}.html`));
}
