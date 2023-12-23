import { get_blob_str } from '../../context.ts';
import { get_blob_url } from '../../utils/url.ts';

import type { EmbeddedImage } from '../../utils/embed.ts';

export interface EmbedImageProps {
	images: EmbeddedImage[];
	is_bordered: boolean;
	allow_standalone_ratio: boolean;
}

const enum RenderMode {
	MULTIPLE,
	STANDALONE,
	STANDALONE_RATIO,
}

function EmbedImage({ images, is_bordered, allow_standalone_ratio }: EmbedImageProps) {
	const length = images.length;
	const is_standalone_image = allow_standalone_ratio && length === 1 && 'aspectRatio' in images[0];

	return (
		<div
			class={
				'EmbedImage' +
				(is_bordered ? ' EmbedImage--bordered' : '') +
				(is_standalone_image ? ' EmbedImage--standalone' : '')
			}
		>
			{is_standalone_image ? (
				render_img(images[0], RenderMode.STANDALONE_RATIO)
			) : length === 1 ? (
				render_img(images[0], RenderMode.STANDALONE)
			) : length === 2 ? (
				<div class="EmbedImage__grid">
					<div class="EmbedImage__col">{render_img(images[0], RenderMode.MULTIPLE)}</div>
					<div class="EmbedImage__col">{render_img(images[1], RenderMode.MULTIPLE)}</div>
				</div>
			) : length === 3 ? (
				<div class="EmbedImage__grid">
					<div class="EmbedImage__col">
						{render_img(images[0], RenderMode.MULTIPLE)}
						{render_img(images[1], RenderMode.MULTIPLE)}
					</div>

					<div class="EmbedImage__col">{render_img(images[2], RenderMode.MULTIPLE)}</div>
				</div>
			) : length === 4 ? (
				<div class="EmbedImage__grid">
					<div class="EmbedImage__col">
						{render_img(images[0], RenderMode.MULTIPLE)}
						{render_img(images[2], RenderMode.MULTIPLE)}
					</div>

					<div class="EmbedImage__col">
						{render_img(images[1], RenderMode.MULTIPLE)}
						{render_img(images[3], RenderMode.MULTIPLE)}
					</div>
				</div>
			) : null}
		</div>
	);
}

export default EmbedImage;

function render_img(img: EmbeddedImage, mode: RenderMode) {
	// FIXME: with STANDALONE_RATIO, we are resizing the image to make it fit
	// the container with our given constraints, but this doesn't work when the
	// image hasn't had its metadata loaded yet, the browser will snap to the
	// smallest possible size for our layout.

	const alt = img.alt;
	const aspectRatio = img.aspectRatio;

	let cn: string | undefined;
	let ratio: string | undefined;

	if (mode === RenderMode.MULTIPLE) {
		cn = `EmbedImage__imageContainer--multiple`;
	} else if (mode === RenderMode.STANDALONE) {
		cn = `EmbedImage__imageContainer--standalone`;
	} else if (mode === RenderMode.STANDALONE_RATIO) {
		cn = `EmbedImage__imageContainer--standaloneRatio`;
		ratio = `${aspectRatio!.width}/${aspectRatio!.height}`;
	}

	return (
		<div class={'EmbedImage__imageContainer ' + cn} style={{ 'aspect-ratio': ratio }}>
			<img loading="lazy" src={get_blob_url(get_blob_str(img.image))} alt={alt} class="EmbedImage__image" />
		</div>
	);
}
