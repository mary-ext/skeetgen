import { repeat } from '@intrnl/jsx-to-string';

import { get_page_context } from '../context.ts';
import { get_relative_url } from '../utils/url.ts';

import { create_pagination } from '../utils/pagination.ts';
import { type PostTuple, create_timeline_slices } from '../utils/timeline.ts';

import Page from '../components/Page.tsx';
import FeedPost from '../components/FeedPost.tsx';

type FilterType = 'posts' | 'with_replies' | 'media';

export interface TimelinePageProps {
	type: FilterType;
	current_page: number;
	total_pages: number;
	posts: PostTuple[];
}

const TYPE_LABELS: Record<string, string> = {
	posts: 'Posts',
	with_replies: 'Replies',
	media: 'Media',
};

export function TimelinePage({ type, current_page, total_pages, posts }: TimelinePageProps) {
	const ctx = get_page_context();

	const label = TYPE_LABELS[type] ?? type;
	const slices = create_timeline_slices(posts);

	const pagination = create_pagination(current_page, total_pages);

	return (
		<Page title={`@${ctx.profile.handle}'s timeline - ${label} (page ${current_page + 1})`}>
			<div class="Filters">
				<FilterButton type="posts" active={type === 'posts'} />
				<FilterButton type="with_replies" active={type === 'with_replies'} />
				<FilterButton type="media" active={type === 'media'} />
			</div>

			<div class="TimelinePage__feed">
				{repeat(slices, (slice, idx) => {
					return (
						<>
							{idx !== 0 ? <hr class="TimelinePage__feedSeparator" /> : null}

							{repeat(slice.items, (item, idx, arr) => {
								return (
									<FeedPost
										rkey={item.rkey}
										post={item.post}
										has_prev={idx !== 0}
										has_next={idx !== arr.length - 1}
										always_show_replies={true}
									/>
								);
							})}
						</>
					);
				})}
			</div>

			<div class="TimelinePage__pagination">
				{repeat(pagination, (val) => {
					if (typeof val === 'number') {
						return (
							<a
								aria-label={`Go to page ${val}`}
								href={get_relative_url(`/timeline/${type}/${val}.html`)}
								class={
									'Interactive TimelinePage__page Interactive--primary' +
									(val === current_page ? ' TimelinePage__page--active' : '')
								}
							>
								{val}
							</a>
						);
					}

					if (val === 'prev') {
						const disabled = current_page <= 1;

						return (
							<a
								title={!disabled ? `Go to previous page` : undefined}
								href={!disabled ? get_relative_url(`/timeline/${type}/${current_page - 1}.html`) : undefined}
								class={
									'TimelinePage__page' +
									(!disabled ? ' Interactive Interactive--primary' : ' TimelinePage__page--disabled')
								}
							>
								<svg class="TimelinePage__pageIcon TimelinePage__pageIcon--prev" viewBox="0 0 24 24">
									<path fill="currentColor" d="M10 6L8.59 7.41L13.17 12l-4.58 4.59L10 18l6-6z" />
								</svg>
							</a>
						);
					}

					if (val === 'next') {
						const disabled = current_page >= total_pages;

						return (
							<a
								title={!disabled ? `Go to next page` : undefined}
								href={!disabled ? get_relative_url(`/timeline/${type}/${current_page + 1}.html`) : undefined}
								class={
									'TimelinePage__page' +
									(!disabled ? ' Interactive Interactive--primary' : ' TimelinePage__page--disabled')
								}
							>
								<svg class="TimelinePage__pageIcon TimelinePage__pageIcon--next" viewBox="0 0 24 24">
									<path fill="currentColor" d="M10 6L8.59 7.41L13.17 12l-4.58 4.59L10 18l6-6z" />
								</svg>
							</a>
						);
					}

					if (val === 'dots_start' || val === 'dots_end') {
						return (
							<div class="TimelinePage__page TimelinePage__page--disabled">
								<svg class="TimelinePage__pageIcon TimelinePage__pageIcon--boundary" viewBox="0 0 24 24">
									<path
										fill="currentColor"
										d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2"
									/>
								</svg>
							</div>
						);
					}

					return null;
				})}
			</div>
		</Page>
	);
}

interface FilterButtonProps {
	type: FilterType;
	active: boolean;
}

function FilterButton({ active, type }: FilterButtonProps) {
	return (
		<a
			href={get_relative_url(`/timeline/${type}/1.html`)}
			class={'Interactive Interactive--primary Filter' + (active ? ' Filter--active' : '')}
		>
			{TYPE_LABELS[type] ?? type}
		</a>
	);
}
