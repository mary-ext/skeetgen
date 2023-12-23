import * as FlexSearch from '@akryum/flexsearch-es';

import { app, h, memo, text } from './dependencies/hyperapp.js';

/** @typedef {[rkey: string, text: string, timestamp: number, flags: number] & { idx: number }} PostEntry */

/** @type {FlexSearch.Document<PostEntry, true>} */
const index = new FlexSearch.Document({
	document: {
		id: '0',
		index: ['1'],
		store: true,
	},
});

// Add posts to document
{
	/** @type {PostEntry[]} */
	let entries;

	// Grab the JSON that's been embedded into the page
	{
		/** @type {HTMLScriptElement} */
		const node = document.getElementById('search-json');
		node.remove();

		entries = JSON.parse(node.textContent);
	}

	// Go through the entries and add them all.
	{
		for (let i = 0, il = entries.length; i < il; i++) {
			/** @type {PostEntry} */
			const entry = entries[i];
			index.add(entry);
		}
	}
}

// Render our UI
{
	const abs_with_time = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' });

	const HAS_EMBED_IMAGE = 1 << 0;
	const HAS_EMBED_LINK = 1 << 1;
	const HAS_EMBED_RECORD = 1 << 2;
	const HAS_EMBED_FEED = 1 << 3;
	const HAS_EMBED_LIST = 1 << 4;

	const SORT_RELEVANT = 'relevant';
	const SORT_NEW = 'new';
	const SORT_OLD = 'old';

	/** @type {PostEntry[]} */
	let results = [];
	let sort = SORT_RELEVANT;

	const rerender = app({
		node: document.getElementById('root'),
		view() {
			return h('div', {}, [
				h('div', { class: 'SearchPage__header' }, [
					h('input', { class: 'SearchPage__input', oninput: handle_search_input }),
				]),

				h('div', { class: 'Filters' }, [
					render_filter_btn(SORT_RELEVANT, 'Relevant'),
					render_filter_btn(SORT_NEW, 'New'),
					render_filter_btn(SORT_OLD, 'Old'),
				]),

				h(
					'div',
					{},
					results.map((item) =>
						h('div', { class: 'SearchItem', key: item[0] }, [memo(render_search_item, { item: item })]),
					),
				),
			]);
		},
	});

	function handle_filter_button(ev) {
		if (sort !== (sort = ev.target.value)) {
			sort_results();
			rerender();
		}
	}

	function handle_search_input(ev) {
		const [search_results] = index.search(ev.target.value, 200, { enrich: true });

		results = [];

		if (search_results !== undefined) {
			const res = search_results.result;
			for (let i = 0, ilen = res.length; i < ilen; i++) {
				const doc = res[i].doc;
				doc.idx = i;

				results.push(doc);
			}

			if (sort !== SORT_RELEVANT) {
				sort_results();
			}
		}

		rerender();
	}

	function sort_results() {
		if (sort === SORT_RELEVANT) {
			results.sort((a, b) => a.idx - b.idx);
		} else if (sort === SORT_NEW) {
			results.sort((a, b) => b[2] - a[2]);
		} else if (sort === SORT_OLD) {
			results.sort((a, b) => a[2] - b[2]);
		}
	}

	function render_filter_btn(val, label) {
		const active = sort === val;
		const cn = 'Interactive Interactive--primary Filter' + (active ? ' Filter--active' : '');

		return h('button', { value: val, class: cn, onclick: handle_filter_button }, text(label));
	}

	function render_search_item({ item }) {
		const [rkey, post_text, ts, flags] = item;

		return h('div', { class: 'SearchItem__content' }, [
			h('a', { href: `posts/${rkey}.html`, class: 'SearchItem__timestamp' }, [
				text(ts === 0 ? 'N/A' : abs_with_time.format(ts)),
			]),
			h('p', { class: 'SearchItem__body' }, [text(post_text)]),
			(flags & HAS_EMBED_IMAGE) !== 0 && h('p', { class: 'SearchItem__accessory' }, text('[image]')),
		]);
	}
}
