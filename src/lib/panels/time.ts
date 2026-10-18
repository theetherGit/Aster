import { t } from '#lib/i18n/index.ts';

/** "just now", "3 min ago", "2 h ago", "4 d ago". */
export function ago(at: number, now = Date.now()): string {
	const s = Math.max(0, now - at) / 1000;
	if (s < 60) return t('time.justNow');
	if (s < 3600) return t('time.minutes', { n: Math.floor(s / 60) });
	if (s < 86400) return t('time.hours', { n: Math.floor(s / 3600) });
	return t('time.days', { n: Math.floor(s / 86400) });
}
