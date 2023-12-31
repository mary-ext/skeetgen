import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./index.html',
		'./export.html',
		'./src/index.ts',
		'./src/controllers/*.ts',
		'./src/utils/logger.tsx',
	],
	theme: {
		extend: {},
	},
	plugins: [forms()],
};
