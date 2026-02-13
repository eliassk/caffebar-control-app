<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import { theme } from "$lib/themeStore";
  import { pinStore } from "$lib/pinStore";

  onMount(() => {
    theme.init();
    pinStore.load();
  });
</script>

<slot />
