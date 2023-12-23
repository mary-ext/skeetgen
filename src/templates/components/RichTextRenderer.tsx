import { type TrustedHTML, repeat } from '@intrnl/jsx-to-string';

import type { Facet } from '../utils/richtext/types.ts';
import { segment_richtext } from '../utils/richtext/segmentize.ts';
import { get_bsky_app_url } from '../utils/url.ts';

export interface RichTextRendererProps {
	text: string;
	facets: Facet[] | undefined;
}

const cached = new WeakMap<Facet[], TrustedHTML>();

function RichTextRenderer({ text, facets }: RichTextRendererProps) {
	if (facets !== undefined) {
		let rendered = cached.get(facets);

		if (rendered === undefined) {
			const segments = segment_richtext(text, facets);

			const nodes = repeat(segments, (segment) => {
				const text = segment.text;

				const link = segment.link;
				const mention = segment.mention;
				const tag = segment.tag;

				if (link) {
					return (
						<a href={link.uri} target="_blank" rel="noopener noreferrer nofollow" class="Link">
							{text}
						</a>
					);
				} else if (mention) {
					return (
						<a
							aria-label={mention.did}
							href={get_bsky_app_url(`at://${mention.did}/app.bsky.actor.profile/self`)}
							target="_blank"
							class="Mention"
						>
							{text}
						</a>
					);
				} else if (tag) {
					return <span class="Hashtag">{text}</span>;
				}

				return text;
			});

			cached.set(facets, (rendered = <>{nodes}</>));
		}

		return rendered;
	}

	return <>{text}</>;
}

export default RichTextRenderer;
