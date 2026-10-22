<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import ProjectsPage from '#lib/panels/ProjectsPage.svelte';
</script>

<svelte:head>
	<title>{t('projects.windowTitle')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<ProjectsPage />
