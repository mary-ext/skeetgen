import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './export.html', './src/index.ts', './src/controllers/*.ts'],
	theme: {
		extend: {},
	},
	plugins: [forms()],
};
