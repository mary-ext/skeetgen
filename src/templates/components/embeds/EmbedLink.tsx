import { get_blob_str } from '../../context.ts';
import { get_blob_url } from '../../utils/url.ts';

import type { EmbeddedLink } from '../../utils/embed.ts';

export interface EmbedLinkProps {
	link: EmbeddedLink;
}

function EmbedLink({ link }: EmbedLinkProps) {
	return (
		<a href={link.uri} target="_blank" rel="noopener noreferrer nofollow" class="EmbedLink Interactive">
			{link.thumb && (
				<img loading="lazy" src={get_blob_url(get_blob_str(link.thumb))} class="EmbedLink__thumb" />
			)}

			<div class="EmbedLink__main">
				<p class="EmbedLink__domain">{get_domain(link.uri)}</p>
				<p class="EmbedLink__title">{link.title}</p>

				<div class="EmbedLink__desktopOnly">
					<p class="EmbedLink__summary">{link.description}</p>
				</div>
			</div>
		</a>
	);
}

export default EmbedLink;

function get_domain(url: string) {
	try {
		const host = new URL(url).host;
		return host.startsWith('www.') ? host.slice(4) : host;
	} catch {
		return url;
	}
}
