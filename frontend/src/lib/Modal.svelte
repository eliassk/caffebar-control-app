<script lang="ts">
  /** Reusable modal wrapper with backdrop, container, and close-on-backdrop. */
  export let open = true;
  export let titleId = "";
  export let onClose: (() => void) | undefined = undefined;

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget && onClose) onClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId || undefined}
    on:click={handleBackdrop}
  >
    <div class="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg">
      <slot />
    </div>
  </div>
{/if}
