import type { JSXNode } from '@intrnl/jsx-to-string';

import { get_asset_url, get_relative_url } from '../utils/url.ts';

export interface PageProps {
	title?: string;
	children?: JSXNode;
	head?: JSXNode;
}

function Page({ title, children, head }: PageProps) {
	return (
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width" />
				<title>{title}</title>
				<link rel="stylesheet" href={get_asset_url('style.css')} />
				{head}
			</head>
			<body>
				<div class="Root">
					<div class="Page">
						<div class="PageHeader">
							<a href={get_relative_url('/index.html')} class="Link">
								Home
							</a>
							<a href={get_relative_url('/timeline/posts/1.html')} class="Link">
								Timeline
							</a>
							<a href={get_relative_url('/search.html')} class="Link">
								Search
							</a>
						</div>
						{children}
					</div>
				</div>
			</body>
		</html>
	);
}

export default Page;
