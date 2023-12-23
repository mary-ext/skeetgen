import type { RefOf } from '@externdefs/bluesky-client/atp-schema';

export type EmbeddedImage = RefOf<'app.bsky.embed.images#image'>;
export type EmbeddedLink = RefOf<'app.bsky.embed.external#external'>;
export type EmbeddedRecord = RefOf<'com.atproto.repo.strongRef'>;
