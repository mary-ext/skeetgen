const SECOND = 1e3;
const NOW = SECOND * 5;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = WEEK * 4;
const YEAR = MONTH * 12;

const abs_with_time = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' });
const abs_with_year = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const abs = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const formatters: Record<string, Intl.NumberFormat> = {};

const is_nan = Number.isNaN;

export function format_rel_time(time: string | number, base = new Date()) {
	const date = new Date(time);
	const num = date.getTime();

	if (is_nan(num)) {
		return 'N/A';
	}

	const delta = Math.abs(num - base.getTime());

	if (delta > WEEK) {
		// if it's the same year, let's skip showing the year.
		if (date.getFullYear() === base.getFullYear()) {
			return abs.format(date);
		}

		return abs_with_year.format(date);
	}

	if (delta < NOW) {
		return `now`;
	}

	const [value, unit] = lookup_reltime(delta);

	const formatter = (formatters[unit] ||= new Intl.NumberFormat('en-US', {
		style: 'unit',
		unit: unit,
		unitDisplay: 'narrow',
	}));

	return formatter.format(Math.abs(value));
}

export function format_abs_date(time: string | number) {
	const date = new Date(time);

	if (is_nan(date.getTime())) {
		return 'N/A';
	}

	return abs_with_year.format(date);
}

export function format_abs_date_time(time: string | number) {
	const date = new Date(time);

	if (is_nan(date.getTime())) {
		return 'N/A';
	}

	return abs_with_time.format(date);
}

export function lookup_reltime(delta: number): [value: number, unit: Intl.RelativeTimeFormatUnit] {
	if (delta < SECOND) {
		return [0, 'second'];
	}

	if (delta < MINUTE) {
		return [Math.trunc(delta / SECOND), 'second'];
	}

	if (delta < HOUR) {
		return [Math.trunc(delta / MINUTE), 'minute'];
	}

	if (delta < DAY) {
		return [Math.trunc(delta / HOUR), 'hour'];
	}

	if (delta < WEEK) {
		return [Math.trunc(delta / DAY), 'day'];
	}

	if (delta < MONTH) {
		return [Math.trunc(delta / WEEK), 'week'];
	}

	if (delta < YEAR) {
		return [Math.trunc(delta / MONTH), 'month'];
	}

	return [Math.trunc(delta / YEAR), 'year'];
}
