<script lang="ts">
  export let className: string = "";
  export let padded = true;
</script>

<div
  class="overflow-hidden rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/60 dark:bg-stone-800/60 backdrop-blur-xl shadow-glass transition hover:shadow-soft-lg {padded ? 'p-4' : ''} {className}"
>
  <slot />
</div>
