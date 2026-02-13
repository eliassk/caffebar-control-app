<script lang="ts">
  export let className: string = "";
  export let padded = true;
</script>

<div
  class="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-600 dark:bg-stone-800 bg-surface-card shadow-soft transition hover:shadow-soft-lg {padded ? 'p-4' : ''} {className}"
>
  <slot />
</div>
