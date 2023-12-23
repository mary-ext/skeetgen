import { defineConfig } from 'vite';

import babel from '@rollup/plugin-babel';

import min from '@minify-html/node';

export default defineConfig({
	base: '/skeetgen/',
	optimizeDeps: {
		include: ['@intrnl/jsx-to-string/runtime'],
	},
	build: {
		rollupOptions: {
			input: {
				index: './index.html',
				export: './export.html',
			},
		},
	},
	plugins: [
		{
			enforce: 'pre',
			...babel({
				babelrc: false,
				babelHelpers: 'bundled',
				extensions: ['.tsx'],
				plugins: [['@babel/plugin-syntax-typescript', { isTSX: true }], ['@intrnl/jsx-to-string/babel']],
			}),
		},
		{
			name: 'minify-html',
			transformIndexHtml(source) {
				const encoder = new TextEncoder();
				const decoder = new TextDecoder();

				const buffer = min.minify(encoder.encode(source), {});

				return { tags: [], html: decoder.decode(buffer) };
			},
		},
	],
});
