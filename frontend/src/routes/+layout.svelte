<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import "../app.css";
  import { theme } from "$lib/themeStore";
  import { pinStore } from "$lib/pinStore";
  import { lockAppWithPin } from "$lib/lockAppWithPinStore";

  onMount(async () => {
    theme.init();
    await pinStore.load();
    if (get(lockAppWithPin) && pinStore.hasPin()) {
      pinStore.lock();
    }
  });
</script>

<slot />
