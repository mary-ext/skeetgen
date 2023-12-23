import { coerce } from 'multiformats/bytes';
import { from } from 'multiformats/hashes/hasher';

export const sha256 = (input: Uint8Array) => {
	return crypto.subtle.digest('sha-256', input);
};

export const mf_sha256 = from({
	name: 'sha2-256',
	code: 0x12,
	encode: async (input) => {
		const digest = await sha256(input);
		return coerce(digest);
	},
});
