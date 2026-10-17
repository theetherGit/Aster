<script lang="ts">
	import { t } from '#lib/i18n/index.js';
</script>

<svelte:head>
	<title>{t('app.name')}</title>
</svelte:head>

<main class="p-6">
	<h1 class="text-2xl font-semibold">{t('app.name')}</h1>
	<p>{t('app.tagline')}</p>
</main>
