<script lang="ts">
  import type { CoffeeEntity } from "$lib/api";

  export let entity: CoffeeEntity;
  export let secondary: string | null = null;
  export let busy = false;
  export let canToggle = false;
  export let onToggle: () => void = () => {};

  $: isOn = entity.state === "on";
  $: isUnavailable =
    entity.state === "unavailable" || entity.state === "unknown";
</script>

<button
  type="button"
  class="flex min-h-tile flex-col items-start justify-center rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:ring-offset-2 focus:ring-offset-coffee-950 disabled:opacity-60 {canToggle
    ? isOn
      ? 'border-coffee-500 bg-coffee-700/60 hover:bg-coffee-700'
      : 'border-coffee-700 bg-coffee-800/80 hover:bg-coffee-800'
    : 'cursor-default border-coffee-800 bg-coffee-800/80'}"
  disabled={!canToggle || busy}
  onclick={() => canToggle && onToggle()}
>
  <span class="font-display text-base font-semibold text-coffee-100 sm:text-lg">
    {entity.friendly_name}
  </span>
  {#if secondary}
    <span class="mt-0.5 text-sm text-coffee-300">{secondary}</span>
  {/if}
  {#if canToggle}
    <span class="mt-2 flex items-center gap-2">
      {#if busy}
        <span class="text-sm text-coffee-400">Updating…</span>
      {:else if isUnavailable}
        <span class="text-sm text-amber-400">Unavailable</span>
      {:else}
        <span
          class="inline-flex h-3 w-8 shrink-0 rounded-full border-2 border-coffee-600 transition {isOn
            ? 'border-coffee-400 bg-coffee-400'
            : 'bg-coffee-700'}"
        >
          <span
            class="block h-2 w-2 translate-y-0.5 rounded-full bg-coffee-950 transition {isOn
              ? 'translate-x-4'
              : 'translate-x-0.5'}"
          ></span>
        </span>
        <span class="text-sm text-coffee-300">{isOn ? "On" : "Off"}</span>
      {/if}
    </span>
  {:else}
    <span class="mt-2 text-sm {isUnavailable ? 'text-amber-400' : 'text-coffee-300'}">
      {isUnavailable ? "—" : entity.state}
    </span>
  {/if}
</button>
