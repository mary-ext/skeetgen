export function target<T extends HTMLElement | SVGElement>(base: HTMLElement, name: string) {
	return { get: () => base.querySelector<T>(`[data-target~="${base.localName}.${name}"]`) };
}
