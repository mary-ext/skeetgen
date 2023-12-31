// @ts-expect-error
Symbol.dispose ??= Symbol.for('Symbol.dispose');

const time_format = new Intl.DateTimeFormat('en-US', { timeStyle: 'short', hour12: false });

let uid = 0;

export class Logger {
	public container: HTMLElement;
	public signal: AbortSignal | undefined;

	private _ephemeral: HTMLElement;
	private _persistent: HTMLElement;

	private _destroy = this.destroy.bind(this);

	constructor(parent: HTMLElement, signal?: AbortSignal) {
		const id = 'log_container_' + uid++;

		const html = (
			<div id={id} class="flex flex-col font-mono text-[13px]">
				<ul class="contents"></ul>
				<ul class="contents"></ul>
			</div>
		);

		parent.insertAdjacentHTML('beforeend', html.value);

		this.container = parent.ownerDocument.getElementById(id)!;
		this._persistent = this.container.firstChild! as HTMLElement;
		this._ephemeral = this._persistent.nextSibling! as HTMLElement;

		if (signal) {
			signal.throwIfAborted();
			signal.addEventListener('abort', this._destroy);

			this.signal = signal;
		}
	}

	log(message: string) {
		const now = Date.now();

		const html = (
			<li class="flex gap-1.5 px-1 py-0.5">
				<span class="whitespace-pre-wrap text-white/50">{time_format.format(now)}</span>
				<span class="text-white">{message}</span>
			</li>
		);

		this._ephemeral.insertAdjacentHTML('afterbegin', html.value);
	}

	warn(message: string) {
		const now = Date.now();

		const html = (
			<li class="flex gap-1.5 bg-yellow-950 px-1 py-0.5">
				<span class="whitespace-pre-wrap text-white/50">{time_format.format(now)}</span>
				<span class="text-white">{message}</span>
			</li>
		);

		this._ephemeral.insertAdjacentHTML('afterbegin', html.value);
	}

	error(message: string) {
		const now = Date.now();

		const html = (
			<li class="flex gap-1.5 bg-red-950 px-1 py-0.5">
				<span class="whitespace-pre-wrap text-white/50">{time_format.format(now)}</span>
				<span class="text-white">{message}</span>
			</li>
		);

		this._ephemeral.insertAdjacentHTML('afterbegin', html.value);
	}

	progress(message: string = '', interval: number | null = 250) {
		const id = 'log_progress_' + uid++;

		const html = (
			<li id={id} class="flex gap-1.5 px-1 py-0.5">
				<span class="whitespace-pre-wrap text-white/50">-----</span>
				<span class="text-white"> </span>
			</li>
		);

		this._persistent.insertAdjacentHTML('afterbegin', html.value);

		const container = this.container.ownerDocument.getElementById(id)! as HTMLElement;
		const text = container.firstChild!.nextSibling!.firstChild! as Text;

		text.data = message;
		return new ProgressLogger(container, text, interval);
	}

	destroy() {
		this.signal?.removeEventListener('abort', this._destroy);
		this.container.remove();
	}
}

class ProgressLogger {
	private _container: HTMLElement;
	private _text: Text;
	private _interval: number | null;

	public ratelimited = false;

	constructor(container: HTMLElement, text: Text, interval: number | null) {
		this._container = container;
		this._text = text;
		this._interval = interval;
	}

	update(message: string) {
		if (this._interval === null) {
			this._text.data = message;
		} else if (!this.ratelimited) {
			this.ratelimited = true;
			this._text.data = message;

			setTimeout(() => {
				this.ratelimited = false;
			}, this._interval);
		}
	}

	destroy() {
		this._container.remove();
	}

	[Symbol.dispose]() {
		return this.destroy();
	}
}
