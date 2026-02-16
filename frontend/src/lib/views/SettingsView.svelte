<script lang="ts">
  import { t } from "$lib/i18n";
  import { Sun, Moon, Monitor, Save, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-svelte";
  import type { Scene } from "$lib/api";
  import { customWelcome } from "$lib/settingsStore";
  import { checklistItems } from "$lib/checklistStore";
  import { theme } from "$lib/themeStore";
  import { pinStore } from "$lib/pinStore";
  import { lockAppWithPin } from "$lib/lockAppWithPinStore";
  import PinSetupModal from "$lib/PinSetupModal.svelte";
  import PinLockScreen from "$lib/PinLockScreen.svelte";
  import { safeColor, getSceneIcon } from "$lib/sceneHelpers";

  export let scenes: Scene[];
  export let appVersion: string;
  export let settingsUnlocked: boolean;
  export let onOpenSaveSceneModal: () => void;
  export let onOpenEditSceneModal: (scene: Scene) => void;
  export let onDeleteScene: (scene: Scene) => void;

  let showPinSetupModal = false;
  let pinSetupMode: "set" | "change" | "remove" = "set";

  let settingsTitleInput = "";
  let settingsSavedFlash = false;
  let checklistNewItem = "";
  let prevSettingsOpen = false;

  // Re-populate inputs each time settings becomes visible
  $: if (!prevSettingsOpen) {
    settingsTitleInput = ($customWelcome?.title || "").trim() || t.welcomeTitle;
  }
  $: prevSettingsOpen = true;

  function saveCustomWelcome() {
    customWelcome.set({
      title: settingsTitleInput.trim() || t.welcomeTitle,
      desc: "",
    });
    settingsSavedFlash = true;
    setTimeout(() => (settingsSavedFlash = false), 2000);
  }

  function resetCustomWelcome() {
    customWelcome.set(null);
    settingsTitleInput = t.welcomeTitle;
  }

  function addChecklistItem() {
    const label = checklistNewItem.trim();
    if (label) {
      checklistItems.add(label);
      checklistNewItem = "";
    }
  }
</script>

<div class="w-full min-w-0 max-w-full sm:mx-auto sm:max-w-4xl">
  {#if $pinStore.pinHash && !settingsUnlocked}
    <PinLockScreen mode="unlock" onUnlock={() => (settingsUnlocked = true)} />
  {/if}
  <h1 class="font-display text-2xl font-bold text-stone-800 dark:text-stone-100">
    {t.settingsTitle}
  </h1>
  <div class="mt-6 min-w-0 overflow-hidden rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/60 dark:bg-stone-800/60 backdrop-blur-xl p-4 sm:p-6 shadow-glass">
    <div class="space-y-4 min-w-0">
      <!-- Theme -->
      <div role="group" aria-label={t.settingsTheme}>
        <span class="block text-sm font-medium text-stone-600 dark:text-stone-400">{t.settingsTheme}</span>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition {$theme === 'light'
              ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
              : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-500'}"
            on:click={() => theme.set('light')}
          >
            <Sun class="h-4 w-4" />
            {t.themeLight}
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition {$theme === 'dark'
              ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
              : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-500'}"
            on:click={() => theme.set('dark')}
          >
            <Moon class="h-4 w-4" />
            {t.themeDark}
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition {$theme === 'system'
              ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
              : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-500'}"
            on:click={() => theme.set('system')}
          >
            <Monitor class="h-4 w-4" />
            {t.themeSystem}
          </button>
        </div>
      </div>

      <!-- PIN -->
      <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
        <span class="block text-sm font-medium text-stone-600 dark:text-stone-400">{t.pinLockSection}</span>
        {#if $pinStore.pinHash}
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-50 dark:hover:bg-stone-600"
              on:click={() => { pinSetupMode = 'change'; showPinSetupModal = true; }}
            >
              {t.pinChange}
            </button>
            <button
              type="button"
              class="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-stone-700 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
              on:click={() => { pinSetupMode = 'remove'; showPinSetupModal = true; }}
            >
              {t.pinRemove}
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="mt-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-50 dark:hover:bg-stone-600"
            on:click={() => { pinSetupMode = 'set'; showPinSetupModal = true; }}
          >
            {t.pinSet}
          </button>
        {/if}
        {#if $pinStore.pinHash}
          <div class="mt-4 flex items-start gap-3">
            <input
              id="lock-whole-app"
              type="checkbox"
              bind:checked={$lockAppWithPin}
              on:change={() => { if ($lockAppWithPin) pinStore.lock(); }}
              class="mt-1 h-4 w-4 rounded border-stone-300 text-accent focus:ring-accent"
            />
            <label for="lock-whole-app" class="flex-1">
              <span class="block text-sm font-medium text-stone-700 dark:text-stone-300">{t.pinLockWholeApp}</span>
              <span class="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">{t.pinLockWholeAppHelp}</span>
            </label>
          </div>
        {/if}
      </div>

      <!-- Scenes list -->
      <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
        <span class="block text-sm font-medium text-stone-600 dark:text-stone-400">{t.scenesTitle}</span>
        {#if scenes.length > 0}
          <ul class="mt-3 space-y-2">
            {#each scenes as scene (scene.id)}
              <li class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-stone-200 dark:border-stone-600 dark:bg-stone-800/50 bg-stone-50/50 px-3 py-2">
                <span class="flex min-w-0 flex-1 items-center gap-2">
                  {#if scene.icon || safeColor(scene.color)}
                    <span
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {safeColor(scene.color) ? 'text-white' : 'bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-300'}"
                      style={safeColor(scene.color) ? `background-color: ${safeColor(scene.color)}` : ''}
                    >
                      <svelte:component this={getSceneIcon(scene.icon)} class="h-4 w-4" />
                    </span>
                  {/if}
                  <span class="min-w-0 truncate text-sm font-medium text-stone-700 dark:text-stone-300" title={scene.name}>{scene.name}</span>
                </span>
                <div class="flex shrink-0 gap-1">
                  <button
                    type="button"
                    class="rounded-lg px-2 py-1 text-xs font-medium text-stone-600 dark:text-stone-400 transition hover:bg-stone-200 dark:hover:bg-stone-700"
                    on:click={() => onOpenEditSceneModal(scene)}
                  >
                    {t.sceneEdit}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                    on:click={() => onDeleteScene(scene)}
                  >
                    {t.sceneDelete}
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-2 text-sm text-stone-500 dark:text-stone-400">{t.scenesEmpty}</p>
        {/if}
        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/50 px-4 py-3 font-medium text-stone-600 dark:text-stone-400 transition hover:border-accent hover:bg-accent/5 hover:text-accent dark:hover:border-accent dark:hover:bg-accent/10 dark:hover:text-accent"
          on:click={onOpenSaveSceneModal}
        >
          <Save class="h-4 w-4 shrink-0" />
          {t.sceneSaveAs}
        </button>
      </div>

      <!-- Welcome title -->
      <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
        <label for="welcome-title" class="block text-sm font-medium text-stone-600 dark:text-stone-400">
          {t.settingsWelcomeTitle}
        </label>
        <input
          id="welcome-title"
          type="text"
          bind:value={settingsTitleInput}
          class="mt-1.5 w-full rounded-xl border border-white/30 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          placeholder={t.welcomeTitle}
        />
      </div>

      <!-- Checklist management -->
      <div id="settings-checklist" class="border-t border-stone-200 dark:border-stone-600 pt-6">
        <label for="checklist-add" class="block text-sm font-medium text-stone-600 dark:text-stone-400">{t.checklistTitle}</label>
        <p class="mt-0.5 text-xs text-stone-500">{t.checklistHelp}</p>
        <div class="mt-2 flex min-w-0 gap-2">
          <input
            id="checklist-add"
            type="text"
            bind:value={checklistNewItem}
            placeholder={t.checklistAddPlaceholder}
            class="min-w-0 flex-1 rounded-xl border border-white/30 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            on:keydown={(e) => e.key === "Enter" && addChecklistItem()}
          />
          <button
            type="button"
            class="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]"
            on:click={addChecklistItem}
          >
            <Plus class="h-4 w-4" />
          </button>
        </div>
        {#if $checklistItems.length > 0}
          <ul class="mt-3 space-y-2">
            {#each $checklistItems as item, i (item.id)}
              <li class="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-600 dark:bg-stone-800/50 bg-stone-50/50 px-3 py-2">
                <div class="flex flex-col gap-0.5">
                  <button
                    type="button"
                    class="rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={t.ariaMoveUp}
                    disabled={i === 0}
                    on:click={() => checklistItems.moveUp(item.id)}
                  >
                    <ChevronUp class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={t.ariaMoveDown}
                    disabled={i === $checklistItems.length - 1}
                    on:click={() => checklistItems.moveDown(item.id)}
                  >
                    <ChevronDown class="h-4 w-4" />
                  </button>
                </div>
                <span class="flex-1 text-sm text-stone-700 dark:text-stone-300">{item.label}</span>
                <button
                  type="button"
                  class="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
                  aria-label={t.ariaRemove}
                  on:click={() => checklistItems.remove(item.id)}
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <!-- Save / Reset -->
    <div class="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        class="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-accent-hover active:scale-[0.98]"
        on:click={saveCustomWelcome}
      >
        {settingsSavedFlash ? t.settingsSaved : t.settingsSave}
      </button>
      <button
        type="button"
        class="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 active:scale-[0.98]"
        on:click={resetCustomWelcome}
      >
        {t.settingsReset}
      </button>
    </div>

    <!-- Version -->
    {#if appVersion}
      <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
        <p class="text-xs text-stone-500 dark:text-stone-400">
          {t.settingsVersion}: {appVersion}
        </p>
      </div>
    {/if}
  </div>
</div>

{#if showPinSetupModal}
  <PinSetupModal
    mode={pinSetupMode}
    onClose={() => (showPinSetupModal = false)}
    onSuccess={() => (showPinSetupModal = false)}
  />
{/if}
