<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";
  import {
    Coffee,
    Home,
    Lightbulb,
    BarChart3,
    Sun,
    Flame,
    Menu,
    Thermometer,
    Loader2,
    Settings,
    Plus,
    Trash2,
    CheckSquare,
    Square,
    ChevronUp,
    ChevronDown,
    Moon,
    Monitor,
    Save,
    Play,
    DoorOpen,
    DoorClosed,
    Sparkles,
    Zap,
  } from "lucide-svelte";
  import { customWelcome } from "$lib/settingsStore";
  import { checklistItems, checklistState, checklistWithState, refreshChecklistState } from "$lib/checklistStore";
  import {
    fetchEntities,
    fetchLightGroupsConfig,
    subscribeEntitiesStream,
    toggleEntity,
    callService,
    healthCheck,
    fetchScenes,
    createScene,
    updateScene,
    deleteScene,
    applyScene,
    type CoffeeEntity,
    type LightGroupConfig,
    type Scene,
    type SceneEntity,
  } from "$lib/api";
  import SensorTempCard from "$lib/cards/SensorTempCard.svelte";
  import SensorMotionCard from "$lib/cards/SensorMotionCard.svelte";
  import SensorGenericCard from "$lib/cards/SensorGenericCard.svelte";
  import ClimateCard from "$lib/cards/ClimateCard.svelte";
  import FloorWarmingCard from "$lib/cards/FloorWarmingCard.svelte";
  import LightToggleCard from "$lib/cards/LightToggleCard.svelte";
  import LightDimmerCard from "$lib/cards/LightDimmerCard.svelte";
  import LightRGBWCard from "$lib/cards/LightRGBWCard.svelte";
  import SwitchCard from "$lib/cards/SwitchCard.svelte";
  import TemperatureDetailModal from "$lib/TemperatureDetailModal.svelte";
  import TemperatureGraphCard from "$lib/TemperatureGraphCard.svelte";
  import { groupLights } from "$lib/lightGroups";
  import { theme } from "$lib/themeStore";
  import { pinStore } from "$lib/pinStore";
  import PinSetupModal from "$lib/PinSetupModal.svelte";
  import PinLockScreen from "$lib/PinLockScreen.svelte";

  const SCENE_ICONS: Record<string, typeof Coffee> = {
    coffee: Coffee,
    home: Home,
    sun: Sun,
    moon: Moon,
    lightbulb: Lightbulb,
    flame: Flame,
    doorOpen: DoorOpen,
    doorClosed: DoorClosed,
    sparkles: Sparkles,
    zap: Zap,
    play: Play,
  };
  const SCENE_ICON_KEYS = Object.keys(SCENE_ICONS);
  const SCENE_COLORS = [
    "#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899",
    "#8b5cf6", "#06b6d4", "#84cc16", "#64748b",
  ];
  function getSceneIcon(icon?: string | null) {
    return (icon && SCENE_ICONS[icon]) || Play;
  }

  const POLL_MS = 3000;
  type View = "overview" | "lighting" | "temperature" | "hvac" | "settings";

  let entities: CoffeeEntity[] = [];
  let lightGroupsConfig: LightGroupConfig[] = [];
  let online = true;
  let demoMode = false;
  let lastError: string | null = null;
  let showAllOffConfirm = false;
  let toggling: Set<string> = new Set();
  let view: View = "overview";
  let selectedTempEntity: CoffeeEntity | null = null;
  let scenes: Scene[] = [];
  let sceneBusy: string | null = null;
  let sidebarOpen = false;
  let showSaveSceneModal = false;
  let saveSceneNameInput = "";
  let saveSceneIconInput = "";
  let saveSceneColorInput = "";
  let showEditSceneModal: Scene | null = null;
  let editSceneNameInput = "";
  let editSceneIconInput = "";
  let editSceneColorInput = "";
  let showDeleteSceneConfirm: Scene | null = null;
  let showPinSetupModal = false;
  let pinSetupMode: "set" | "change" | "remove" = "set";
  let settingsUnlocked = false;

  $: tempSensors = entities.filter(
    (e) =>
      e.domain === "sensor" &&
      ((e.attributes as Record<string, unknown>).device_class === "temperature" ||
        (e.attributes as Record<string, unknown>).unit_of_measurement === "°C")
  );
  $: weatherEntities = entities.filter((e) => e.domain === "weather");
  $: motionSensors = entities.filter(
    (e) =>
      e.domain === "binary_sensor" ||
      (e.domain === "sensor" &&
        (e.attributes as Record<string, unknown>).device_class === "motion")
  );
  $: otherSensors = entities.filter(
    (e) =>
      e.domain === "sensor" &&
      !tempSensors.includes(e) &&
      !motionSensors.includes(e)
  );
  $: climate = entities.filter((e) => e.domain === "climate");
  function isFloorWarming(e: CoffeeEntity): boolean {
    const name = String((e.attributes as Record<string, unknown>).friendly_name ?? "").toLowerCase();
    const id = e.entity_id.toLowerCase();
    return (
      /floor|warming|podłog|podloga|underfloor|floor_heating|ogrzewanie/.test(id) ||
      /floor|warming|podłog|podloga|ogrzewanie podłogowe/.test(name)
    );
  }
  $: climateFloor = climate.filter(isFloorWarming);
  $: climateHvac = climate.filter((e) => !isFloorWarming(e));
  $: lights = entities.filter((e) => e.domain === "light");
  $: switches = entities.filter((e) => e.domain === "switch");

  $: lightsOn = lights.filter((e) => e.state === "on").length;
  function isOutsideTemp(e: CoffeeEntity): boolean {
    const name = String((e.attributes as Record<string, unknown>).friendly_name ?? "");
    return /outside|outdoor|external/i.test(e.entity_id) || /outside|outdoor|external/i.test(name);
  }
  $: outsideTempSensors = tempSensors.filter(isOutsideTemp);
  $: insideTempSensors = tempSensors.filter((e) => !isOutsideTemp(e));
  $: insideTempSensor = insideTempSensors[0] ?? null;
  $: outsideTempSensor = outsideTempSensors[0] ?? null;
  $: outsideWeatherEntity = weatherEntities[0] ?? null;
  $: outsideTempEntity = (outsideWeatherEntity ? { ...outsideWeatherEntity, state: String((outsideWeatherEntity.attributes as Record<string, unknown>).temperature ?? ""), attributes: { ...outsideWeatherEntity.attributes, unit_of_measurement: "°C" } } : null) ?? outsideTempSensor;
  $: primaryTemp = insideTempSensor ?? tempSensors[0];
  $: primaryTempValue = primaryTemp && primaryTemp.state !== "unavailable" && primaryTemp.state !== "unknown" ? primaryTemp.state : null;
  $: primaryHvac = climateHvac[0] ?? null;
  $: primaryFloor = climateFloor[0] ?? null;
  $: hvacState = primaryHvac
    ? (() => {
        const attrs = primaryHvac.attributes as Record<string, unknown>;
        const presetModes = attrs.preset_modes as string[] | undefined;
        const presetMode = attrs.preset_mode as string | undefined;
        if (Array.isArray(presetModes) && presetModes.length > 0) {
          const p = String(presetMode ?? "").trim();
          return p === "none" || p === "" ? t.modeOff : presetMode;
        }
        if (primaryHvac.state === "off") return t.modeOff;
        if (primaryHvac.state === "auto") return t.modeAuto;
        if (primaryHvac.state === "optimal") return t.modeOptimal;
        if (primaryHvac.state === "comfort") return t.modeComfort;
        return primaryHvac.state;
      })()
    : null;
  $: hvacTargetTemp = primaryHvac && typeof (primaryHvac.attributes as Record<string, unknown>)?.temperature === "number"
    ? (primaryHvac.attributes as Record<string, unknown>).temperature as number
    : null;
  $: floorIsOn = primaryFloor && ((primaryFloor.attributes as Record<string, unknown>).hvac_action === "heating" || primaryFloor.state === "heat" || primaryFloor.state === "heating");
  $: floorTargetTemp = primaryFloor && typeof (primaryFloor.attributes as Record<string, unknown>)?.temperature === "number"
    ? (primaryFloor.attributes as Record<string, unknown>).temperature as number
    : null;

  function sanitizeError(msg: string): string {
    const trimmed = msg.trim();
    if (trimmed.length > 280 || trimmed.startsWith("<!") || trimmed.toLowerCase().includes("<html")) {
      return t.errorCannotReach;
    }
    return trimmed;
  }

  async function load() {
    try {
      entities = await fetchEntities();
      lastError = null;
      online = true;
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorFailedToLoad);
      online = false;
    }
  }

  async function checkHealth() {
    try {
      const { ok, demo_mode } = await healthCheck();
      online = ok;
      demoMode = demo_mode ?? false;
      if (ok && lastError) load();
    } catch {
      online = false;
    }
  }

  onMount(() => {
    load();
    fetchLightGroupsConfig().then((cfg) => (lightGroupsConfig = cfg));
    loadScenes();
    checkHealth();
    refreshChecklistState();
    const streamUnsub = subscribeEntitiesStream(
      (data) => {
        entities = data;
        lastError = null;
        online = true;
      },
      () => {
        /* stream error: fall back to polling */
      }
    );
    const pollInterval = setInterval(load, POLL_MS);
    const healthInterval = setInterval(checkHealth, 10000);
    const checklistInterval = setInterval(refreshChecklistState, 60000);
    return () => {
      streamUnsub();
      clearInterval(pollInterval);
      clearInterval(healthInterval);
      clearInterval(checklistInterval);
    };
  });

  async function toggle(entity: CoffeeEntity) {
    if (entity.domain !== "switch" && entity.domain !== "light") return;
    toggling = new Set(toggling);
    toggling.add(entity.entity_id);
    try {
      await toggleEntity(entity.entity_id);
      /* stream pushes updated entities */
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorToggleFailed);
      await load();
    } finally {
      toggling = new Set(toggling);
      toggling.delete(entity.entity_id);
      toggling = toggling;
    }
  }

  async function turnOffLightsSwitchesAndHvac() {
    const toTurnOff = [...lights, ...switches].filter((e) => e.state === "on");
    for (const e of toTurnOff) {
      try {
        await toggleEntity(e.entity_id);
      } catch (err) {
        lastError = sanitizeError(err instanceof Error ? err.message : t.errorToggleFailed);
      }
    }
    const toTurnOffClimate = climate.filter((e) => e.state !== "off" && e.state !== "unavailable" && e.state !== "unknown");
    for (const e of toTurnOffClimate) {
      try {
        if (isFloorWarming(e)) {
          await callService("climate", "set_hvac_mode", e.entity_id, { hvac_mode: "off" });
        } else {
          await callService("climate", "turn_off", e.entity_id);
        }
      } catch (err) {
        lastError = sanitizeError(err instanceof Error ? err.message : t.errorToggleFailed);
      }
    }
  }

  async function allOff() {
    await turnOffLightsSwitchesAndHvac();
    showAllOffConfirm = false;
    await load();
  }

  async function loadScenes() {
    try {
      scenes = await fetchScenes();
    } catch {
      scenes = [];
    }
  }

  function captureCurrentState(): SceneEntity[] {
    const result: SceneEntity[] = [];
    for (const e of lights) {
      const attrs = e.attributes as Record<string, unknown>;
      const ent: SceneEntity = { entity_id: e.entity_id, state: e.state };
      if (e.state === "on") {
        const att: Record<string, unknown> = {};
        if (typeof attrs.brightness === "number") att.brightness = attrs.brightness;
        if (Array.isArray(attrs.rgb_color)) att.rgb_color = attrs.rgb_color;
        if (typeof attrs.color_temp === "number") att.color_temp = attrs.color_temp;
        if (typeof attrs.white_value === "number") att.white_value = attrs.white_value;
        if (Object.keys(att).length > 0) ent.attributes = att;
      }
      result.push(ent);
    }
    return result;
  }

  async function runScene(scene: Scene) {
    if (sceneBusy) return;
    sceneBusy = scene.id;
    try {
      await applyScene(scene.id);
      /* stream pushes updated entities */
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed);
      await load();
    } finally {
      sceneBusy = null;
    }
  }

  async function saveSceneFromModal() {
    const name = saveSceneNameInput.trim();
    if (!name) return;
    try {
      await createScene(name, captureCurrentState(), {
        icon: saveSceneIconInput || undefined,
        color: saveSceneColorInput || undefined,
      });
      showSaveSceneModal = false;
      saveSceneNameInput = "";
      saveSceneIconInput = "";
      saveSceneColorInput = "";
      await loadScenes();
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed);
    }
  }

  function openSaveSceneModal() {
    saveSceneNameInput = "";
    saveSceneIconInput = "";
    saveSceneColorInput = "";
    showSaveSceneModal = true;
  }

  function openEditSceneModal(scene: Scene) {
    editSceneNameInput = scene.name;
    editSceneIconInput = scene.icon ?? "";
    editSceneColorInput = scene.color ?? "";
    showEditSceneModal = scene;
  }

  async function saveSceneEdit() {
    if (!showEditSceneModal) return;
    const name = editSceneNameInput.trim();
    if (!name) return;
    try {
      await updateScene(showEditSceneModal.id, {
        name,
        icon: editSceneIconInput || undefined,
        color: editSceneColorInput || undefined,
      });
      showEditSceneModal = null;
      await loadScenes();
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed);
    }
  }

  async function replaceSceneWithCurrent() {
    if (!showEditSceneModal) return;
    try {
      await updateScene(showEditSceneModal.id, { entities: captureCurrentState() });
      showEditSceneModal = null;
      await loadScenes();
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed);
    }
  }

  async function confirmDeleteScene() {
    if (!showDeleteSceneConfirm) return;
    const id = showDeleteSceneConfirm.id;
    showDeleteSceneConfirm = null;
    try {
      await deleteScene(id);
      await loadScenes();
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed);
    }
  }

  function supportsBrightness(a: Record<string, unknown>): boolean {
    const modes = a.supported_color_modes as string[] | undefined;
    if (Array.isArray(modes)) {
      return modes.some((m) => m === "brightness" || m === "color_temp" || m === "hs" || m === "rgb" || m === "rgbw" || m === "rgbww" || m === "xy");
    }
    return a.brightness != null;
  }
  function isDimmerLight(entity: CoffeeEntity): boolean {
    const a = entity.attributes as Record<string, unknown>;
    return supportsBrightness(a) && !a.rgb_color && !a.color_temp && !entity.entity_id.toLowerCase().includes("rgbw");
  }
  function isRGBWLight(entity: CoffeeEntity): boolean {
    const a = entity.attributes as Record<string, unknown>;
    const modes = a.supported_color_modes as string[] | undefined;
    if (Array.isArray(modes) && modes.length === 1 && modes[0] === "onoff") return false;
    return a.rgb_color != null || a.color_temp != null || entity.entity_id.toLowerCase().includes("rgbw");
  }

  $: showMotionAndOther = view === "temperature";
  $: showClimate = view === "hvac";
  $: showLights = view === "lighting";
  $: showPower = view === "lighting";
  $: showTempView = view === "temperature";
  $: showOverviewWelcome = view === "overview";
  $: showSettings = view === "settings";
  $: if (view !== "settings") settingsUnlocked = false;

  let settingsTitleInput = "";
  let settingsDescInput = "";
  let settingsSavedFlash = false;
  let checklistNewItem = "";
  let prevShowSettings = false;
  $: if (showSettings && !prevShowSettings) {
    settingsTitleInput = $customWelcome?.title ?? t.welcomeTitle;
    settingsDescInput = $customWelcome?.desc ?? t.welcomeDesc;
  }
  $: prevShowSettings = showSettings;

  function saveCustomWelcome() {
    customWelcome.set({
      title: settingsTitleInput.trim() || t.welcomeTitle,
      desc: settingsDescInput.trim() || t.welcomeDesc,
    });
    settingsSavedFlash = true;
    setTimeout(() => (settingsSavedFlash = false), 2000);
  }

  function resetCustomWelcome() {
    customWelcome.set(null);
    settingsTitleInput = t.welcomeTitle;
    settingsDescInput = t.welcomeDesc;
  }

  function addChecklistItem() {
    const label = checklistNewItem.trim();
    if (label) {
      checklistItems.add(label);
      checklistNewItem = "";
    }
  }

  function toggleChecklistItem(id: string) {
    checklistState.toggle(id);
  }

  $: lightGroups = groupLights(lights, lightGroupsConfig);
</script>

<div class="flex h-dvh bg-surface-alt dark:bg-stone-900">
  <!-- Backdrop when sidebar open on small screens -->
  <button
    type="button"
    class="fixed inset-0 z-30 bg-black/40 dark:bg-black/60 transition-opacity lg:hidden {sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}"
    aria-label={t.navMenuClose}
    on:click={() => (sidebarOpen = false)}
  />

  <!-- Left sidebar: drawer on small screens, always visible on lg+ -->
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-52 shrink-0 flex-col border-r border-stone-200/80 dark:border-stone-600 dark:bg-stone-900 bg-surface-alt py-5 pl-4 pr-3 shadow-soft-lg transition-transform duration-200 ease-out lg:relative lg:translate-x-0 lg:shadow-none {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
  >
    <div class="flex items-center gap-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
        <Coffee class="h-5 w-5 text-white" />
      </div>
      <span class="font-display text-lg font-semibold text-stone-800 dark:text-stone-200">{t.appName}</span>
    </div>
    <nav class="mt-8 flex flex-1 flex-col gap-1">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition {view === 'overview'
          ? 'bg-accent/10 text-accent dark:bg-accent/20'
          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'}"
        on:click={() => { view = 'overview'; sidebarOpen = false; }}
      >
        <Home class="h-5 w-5 shrink-0" />
        {t.navOverview}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition {view === 'lighting'
          ? 'bg-accent/10 text-accent dark:bg-accent/20'
          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'}"
        on:click={() => { view = 'lighting'; sidebarOpen = false; }}
      >
        <Lightbulb class="h-5 w-5 shrink-0" />
        {t.navLighting}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition {view === 'temperature'
          ? 'bg-accent/10 text-accent dark:bg-accent/20'
          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'}"
        on:click={() => { view = 'temperature'; sidebarOpen = false; }}
      >
        <BarChart3 class="h-5 w-5 shrink-0" />
        {t.navTemperature}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition {view === 'hvac'
          ? 'bg-accent/10 text-accent dark:bg-accent/20'
          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'}"
        on:click={() => { view = 'hvac'; sidebarOpen = false; }}
      >
        <Sun class="h-5 w-5 shrink-0" />
        {t.navHvac}
      </button>
      <div class="mt-auto pt-4">
        <button
          type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition {view === 'settings'
          ? 'bg-accent/10 text-accent dark:bg-accent/20'
          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'}"
          on:click={() => { view = 'settings'; sidebarOpen = false; }}
        >
          <Settings class="h-5 w-5 shrink-0" />
          {t.navSettings}
        </button>
      </div>
    </nav>
  </aside>

  <!-- Main content area -->
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- Top bar -->
    <header class="flex shrink-0 items-center justify-between gap-4 border-b border-stone-200/80 dark:border-stone-600 dark:bg-stone-900 bg-surface px-4 py-3 sm:px-5">
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 dark:text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 lg:hidden"
        aria-label={sidebarOpen ? t.navMenuClose : t.navMenuOpen}
        on:click={() => (sidebarOpen = !sidebarOpen)}
      >
        <Menu class="h-6 w-6" />
      </button>
      <div class="ml-auto flex items-center gap-3">
        {#if demoMode}
          <span class="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent">
            {t.demo}
          </span>
        {/if}
        <div
          class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm {online
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}"
        >
          <span class="h-2 w-2 rounded-full {online ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
          {online ? t.statusOnline : t.statusOffline}
        </div>
        <button
          type="button"
          class="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-accent-hover active:scale-[0.98]"
          on:click={() => (showAllOffConfirm = true)}
        >
          {t.goodbye}
        </button>
      </div>
    </header>

    {#if lastError && !online}
      <div class="shrink-0 bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
        {lastError} — {t.errorShowingLastState}
      </div>
    {/if}

    <!-- Main content -->
    <main class="min-h-0 flex-1 overflow-auto p-5">
      <div class="flex flex-col gap-5">
        {#if showOverviewWelcome}
          <!-- Overview: welcome + scenes -->
          <div class="mx-auto max-w-2xl">
            <div class="rounded-2xl border border-stone-200/80 dark:border-stone-600 dark:bg-stone-800 bg-white p-8 shadow-soft">
              <h1 class="font-display text-2xl font-bold text-stone-800 dark:text-stone-100">
                {$customWelcome?.title ?? t.welcomeTitle}
              </h1>
              <p class="mt-2 text-stone-600 dark:text-stone-400">
                {$customWelcome?.desc ?? t.welcomeDesc}
              </p>
              <!-- Checklist -->
              {#if $checklistWithState.length > 0}
                <div class="mt-6 rounded-xl border border-stone-200/60 dark:border-stone-600 dark:bg-stone-800/50 p-4">
                  <p class="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    {t.checklistTitle}
                  </p>
                  <ul class="space-y-2">
                    {#each $checklistWithState as item (item.id)}
                      <li>
                        <button
                          type="button"
                          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/80 dark:hover:bg-stone-700/50 {item.checked
                            ? 'text-stone-400 dark:text-stone-500 line-through'
                            : 'text-stone-700 dark:text-stone-300'}"
                          on:click={() => toggleChecklistItem(item.id)}
                        >
                          {#if item.checked}
                            <CheckSquare class="h-4 w-4 shrink-0 text-accent" />
                          {:else}
                            <Square class="h-4 w-4 shrink-0 text-stone-400" />
                          {/if}
                          <span>{item.label}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- At a glance -->
              <div class="mt-6 flex flex-wrap gap-3">
                {#if primaryTempValue != null}
                  <span class="inline-flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                    <Thermometer class="h-4 w-4 text-stone-500" />
                    {primaryTempValue}°
                  </span>
                {/if}
                {#if hvacState}
                  <span class="inline-flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                    <Sun class="h-4 w-4 text-stone-500" />
                    {hvacState}{#if hvacTargetTemp != null} · {hvacTargetTemp}°{/if}
                  </span>
                {/if}
                {#if primaryFloor}
                  <span class="inline-flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                    <Flame class="h-4 w-4 text-stone-500" />
                    {floorIsOn ? t.on : t.off}{#if floorTargetTemp != null} · {floorTargetTemp}°{/if}
                  </span>
                {/if}
                <span class="inline-flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                  <Lightbulb class="h-4 w-4 text-stone-500" />
                  {t.lightsOn(lightsOn)}
                </span>
              </div>
              <!-- Scene buttons (only show available scenes) -->
              <div class="mt-8 flex flex-col gap-3">
                {#if scenes.length > 0}
                  <div class="flex flex-wrap gap-3">
                    {#each scenes as scene (scene.id)}
                      <button
                        type="button"
                        class="flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-medium shadow-soft transition active:scale-[0.98] disabled:opacity-60 {scene.color
                          ? 'border-transparent text-white hover:opacity-90'
                          : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 hover:border-stone-300 dark:hover:border-stone-500'}"
                        style={scene.color ? `background-color: ${scene.color}` : ''}
                        disabled={sceneBusy !== null}
                        on:click={() => runScene(scene)}
                      >
                        {#if sceneBusy === scene.id}
                          <Loader2 class="h-4 w-4 shrink-0 animate-spin" />
                        {:else}
                          <svelte:component this={getSceneIcon(scene.icon)} class="h-4 w-4 shrink-0" />
                        {/if}
                        {scene.name}
                      </button>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm text-stone-500 dark:text-stone-400">{t.scenesEmpty}</p>
                {/if}
              </div>
            </div>
          </div>
        {:else if showSettings}
          <!-- Settings -->
          <div class="mx-auto max-w-4xl">
            {#if $pinStore.pinHash && !settingsUnlocked}
              <PinLockScreen mode="unlock" onUnlock={() => (settingsUnlocked = true)} />
            {/if}
            <h1 class="font-display text-2xl font-bold text-stone-800 dark:text-stone-100">
              {t.settingsTitle}
            </h1>
            <div class="mt-6 rounded-2xl border border-stone-200/80 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft">
              <div class="space-y-4">
                <div role="group" aria-label={t.settingsTheme}>
                  <span class="block text-sm font-medium text-stone-600 dark:text-stone-400">
                    {t.settingsTheme}
                  </span>
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
                <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
                  <span class="block text-sm font-medium text-stone-600 dark:text-stone-400">
                    {t.pinLockSection}
                  </span>
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
                </div>
                <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
                  <span class="block text-sm font-medium text-stone-600 dark:text-stone-400">
                    {t.scenesTitle}
                  </span>
                  {#if scenes.length > 0}
                    <ul class="mt-3 space-y-2">
                      {#each scenes as scene (scene.id)}
                        <li class="flex items-center justify-between gap-3 rounded-lg border border-stone-200 dark:border-stone-600 dark:bg-stone-800/50 bg-stone-50/50 px-3 py-2">
                          <span class="flex items-center gap-2 flex-1">
                            {#if scene.icon || scene.color}
                              <span
                                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {scene.color ? 'text-white' : 'bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-300'}"
                                style={scene.color ? `background-color: ${scene.color}` : ''}
                              >
                                <svelte:component this={getSceneIcon(scene.icon)} class="h-4 w-4" />
                              </span>
                            {/if}
                            <span class="text-sm font-medium text-stone-700 dark:text-stone-300">{scene.name}</span>
                          </span>
                          <div class="flex gap-1">
                            <button
                              type="button"
                              class="rounded-lg px-2 py-1 text-xs font-medium text-stone-600 dark:text-stone-400 transition hover:bg-stone-200 dark:hover:bg-stone-700"
                              on:click={() => openEditSceneModal(scene)}
                            >
                              {t.sceneEdit}
                            </button>
                            <button
                              type="button"
                              class="rounded-lg px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                              on:click={() => (showDeleteSceneConfirm = scene)}
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
                    on:click={openSaveSceneModal}
                  >
                    <Save class="h-4 w-4 shrink-0" />
                    {t.sceneSaveAs}
                  </button>
                </div>
                <div class="border-t border-stone-200 dark:border-stone-600 pt-6">
                  <label for="welcome-title" class="block text-sm font-medium text-stone-600 dark:text-stone-400">
                    {t.settingsWelcomeTitle}
                  </label>
                  <input
                    id="welcome-title"
                    type="text"
                    bind:value={settingsTitleInput}
                    class="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-stone-600 dark:bg-stone-700 bg-white px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder={t.welcomeTitle}
                  />
                </div>
                <div>
                  <label for="welcome-desc" class="block text-sm font-medium text-stone-600">
                    {t.settingsWelcomeDesc}
                  </label>
                  <textarea
                    id="welcome-desc"
                    bind:value={settingsDescInput}
                    rows="3"
                    class="mt-1.5 w-full resize-none rounded-xl border border-stone-200 dark:border-stone-600 dark:bg-stone-700 bg-white px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder={t.welcomeDesc}
                  ></textarea>
                </div>
                <div class="border-t border-stone-200 pt-6">
                  <label for="checklist-add" class="block text-sm font-medium text-stone-600">
                    {t.checklistTitle}
                  </label>
                  <p class="mt-0.5 text-xs text-stone-500">
                    {t.checklistHelp}
                  </p>
                  <div class="mt-2 flex gap-2">
                    <input
                      id="checklist-add"
                      type="text"
                      bind:value={checklistNewItem}
                      placeholder={t.checklistAddPlaceholder}
                      class="flex-1 rounded-xl border border-stone-200 dark:border-stone-600 dark:bg-stone-700 bg-white px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
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
            </div>
          </div>
        {:else}
          <h1 class="font-display text-2xl font-bold text-stone-800 dark:text-stone-100">
            {view === "lighting" ? t.titleLighting : view === "temperature" ? t.titleTemperature : t.titleHvac}
          </h1>

          <!-- Status badges -->
          <div class="flex flex-wrap items-center gap-2">
            {#if primaryTempValue != null}
              <span class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
                <Thermometer class="h-4 w-4 text-stone-500 dark:text-stone-400" />
                {primaryTempValue}°
              </span>
            {/if}
            {#if hvacState}
              <span class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
                <Sun class="h-4 w-4 text-stone-500 dark:text-stone-400" />
                {hvacState}{#if hvacTargetTemp != null} · {hvacTargetTemp}°{/if}
              </span>
            {/if}
            {#if primaryFloor}
              <span class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
                <Flame class="h-4 w-4 text-stone-500 dark:text-stone-400" />
                {floorIsOn ? t.on : t.off}{#if floorTargetTemp != null} · {floorTargetTemp}°{/if}
              </span>
            {/if}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
              <Lightbulb class="h-4 w-4 text-stone-500 dark:text-stone-400" />
              {t.lightsOnShort(lightsOn)}
            </span>
          </div>

          <!-- Temperature view: 24h graph (inside + outside) then Inside / Outside cards -->
          {#if showTempView && tempSensors.length > 0}
            <TemperatureGraphCard
              entityId={insideTempSensor?.entity_id ?? tempSensors[0].entity_id}
              secondaryEntityId={outsideTempEntity?.entity_id}
              title={t.graphTitle24h}
            />
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {#if insideTempSensor}
                <SensorTempCard
                  entity={insideTempSensor}
                  onSelect={() => (selectedTempEntity = insideTempSensor)}
                />
              {/if}
              {#if outsideTempEntity}
                <SensorTempCard
                  entity={outsideTempEntity}
                  onSelect={() => (selectedTempEntity = outsideTempEntity)}
                />
              {/if}
              {#each tempSensors.filter((e) => e !== insideTempSensor && e !== outsideTempSensor) as entity (entity.entity_id)}
                <SensorTempCard
                  {entity}
                  onSelect={() => (selectedTempEntity = entity)}
                />
              {/each}
            </div>
          {/if}

          <!-- Card grid -->
          <div class="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#if showMotionAndOther && (motionSensors.length > 0 || otherSensors.length > 0)}
            {#each motionSensors as entity (entity.entity_id)}
              <SensorMotionCard {entity} />
            {/each}
            {#each otherSensors as entity (entity.entity_id)}
              <SensorGenericCard {entity} />
            {/each}
          {/if}

          {#if showClimate && (climateFloor.length > 0 || climateHvac.length > 0)}
            {#each climateFloor as entity (entity.entity_id)}
              <FloorWarmingCard {entity} onUpdate={load} />
            {/each}
            {#each climateHvac as entity (entity.entity_id)}
              <ClimateCard {entity} onUpdate={load} />
            {/each}
          {/if}

          {#if showLights && lights.length > 0}
            {#each lightGroups as { groupId, label, lights: groupLights }}
              <div class="col-span-full mt-8 first:mt-0">
                <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {groupId === "other" ? t.lightGroupOther : label}
                </h2>
                <div class="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {#each groupLights as entity (entity.entity_id)}
                    {#if isRGBWLight(entity)}
                      <LightRGBWCard
                        {entity}
                        onUpdate={load}
                        busy={toggling.has(entity.entity_id)}
                        onServiceCallStart={(id) => {
                          toggling = new Set(toggling);
                          toggling.add(id);
                          toggling = toggling;
                        }}
                        onServiceCallEnd={(id) => {
                          toggling = new Set(toggling);
                          toggling.delete(id);
                          toggling = toggling;
                        }}
                        onError={(msg) => (lastError = sanitizeError(msg))}
                      />
                    {:else if isDimmerLight(entity)}
                      <LightDimmerCard {entity} onUpdate={load} busy={toggling.has(entity.entity_id)} />
                    {:else}
                      <LightToggleCard
                        {entity}
                        onToggle={() => toggle(entity)}
                        busy={toggling.has(entity.entity_id)}
                      />
                    {/if}
                  {/each}
                </div>
              </div>
            {/each}
          {/if}

          {#if showPower && switches.length > 0}
            {#each switches as entity (entity.entity_id)}
              <SwitchCard
                {entity}
                onToggle={() => toggle(entity)}
                busy={toggling.has(entity.entity_id)}
              />
            {/each}
          {/if}
          </div>

          {#if entities.length === 0 && !lastError}
            <div class="flex flex-col items-center justify-center gap-2 py-16 text-stone-500 dark:text-stone-400">
              <p>{t.noEntities}</p>
              <p class="text-sm">
                {t.addEntitiesIn}{" "}
                <code class="rounded bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5">config/allowlist.json</code>
              </p>
            </div>
          {/if}
        {/if}
      </div>
    </main>
  </div>
</div>

{#if selectedTempEntity}
  <TemperatureDetailModal
    entity={selectedTempEntity}
    onClose={() => (selectedTempEntity = null)}
  />
{/if}

{#if showAllOffConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="alloff-title"
  >
    <div class="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg">
      <h2 id="alloff-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
        {t.turnAllOffTitle}
      </h2>
      <p class="mt-2 text-sm text-stone-600 dark:text-stone-400">
        {t.turnAllOffDesc}
      </p>
      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-xl bg-stone-100 dark:bg-stone-700 py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-200 dark:hover:bg-stone-600 active:scale-[0.98]"
          on:click={() => (showAllOffConfirm = false)}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]"
          on:click={allOff}
        >
          {t.turnAllOff}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showSaveSceneModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="save-scene-title"
  >
    <div class="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg">
      <h2 id="save-scene-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
        {t.sceneSaveAs}
      </h2>
      <input
        type="text"
        bind:value={saveSceneNameInput}
        placeholder={t.sceneNamePlaceholder}
        class="mt-4 w-full rounded-xl border border-stone-200 dark:border-stone-600 dark:bg-stone-700 bg-white px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        on:keydown={(e) => e.key === "Enter" && saveSceneFromModal()}
      />
      <div class="mt-4">
        <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneIcon}</span>
        <div class="flex flex-wrap gap-2">
          {#each SCENE_ICON_KEYS as key}
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg transition {saveSceneIconInput === key
                ? 'bg-accent text-white'
                : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'}"
              aria-label={key}
              on:click={() => (saveSceneIconInput = key)}
            >
              <svelte:component this={SCENE_ICONS[key]} class="h-4 w-4" />
            </button>
          {/each}
        </div>
      </div>
      <div class="mt-4">
        <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneColor}</span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="h-9 w-9 rounded-lg border-2 transition {!saveSceneColorInput
              ? 'border-stone-800 dark:border-stone-200'
              : 'border-stone-200 dark:border-stone-600 hover:border-stone-400'}"
            title={t.sceneColorNone}
            on:click={() => (saveSceneColorInput = '')}
          >
            <span class="text-xs text-stone-400">✕</span>
          </button>
          {#each SCENE_COLORS as c}
            <button
              type="button"
              class="h-9 w-9 rounded-lg border-2 transition {saveSceneColorInput === c
                ? 'border-stone-800 dark:border-stone-200 scale-110'
                : 'border-transparent hover:scale-105'}"
              style="background-color: {c}"
              aria-label={c}
              on:click={() => (saveSceneColorInput = saveSceneColorInput === c ? '' : c)}
            />
          {/each}
          <label class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 hover:border-stone-400">
            <input
              type="color"
              class="sr-only"
              value={saveSceneColorInput || '#888888'}
              on:input={(e) => (saveSceneColorInput = e.currentTarget.value)}
            />
            <span class="text-xs text-stone-500">+</span>
          </label>
        </div>
      </div>
      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-xl bg-stone-100 dark:bg-stone-700 py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-200 dark:hover:bg-stone-600 active:scale-[0.98]"
          on:click={() => (showSaveSceneModal = false)}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
          disabled={!saveSceneNameInput.trim()}
          on:click={saveSceneFromModal}
        >
          {t.sceneSave}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showEditSceneModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-scene-title"
  >
    <div class="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg">
      <h2 id="edit-scene-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
        {t.sceneEdit} — {showEditSceneModal.name}
      </h2>
      <input
        type="text"
        bind:value={editSceneNameInput}
        placeholder={t.sceneNamePlaceholder}
        class="mt-4 w-full rounded-xl border border-stone-200 dark:border-stone-600 dark:bg-stone-700 bg-white px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <div class="mt-4">
        <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneIcon}</span>
        <div class="flex flex-wrap gap-2">
          {#each SCENE_ICON_KEYS as key}
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg transition {editSceneIconInput === key
                ? 'bg-accent text-white'
                : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'}"
              aria-label={key}
              on:click={() => (editSceneIconInput = key)}
            >
              <svelte:component this={SCENE_ICONS[key]} class="h-4 w-4" />
            </button>
          {/each}
        </div>
      </div>
      <div class="mt-4">
        <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneColor}</span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="h-9 w-9 rounded-lg border-2 transition {!editSceneColorInput
              ? 'border-stone-800 dark:border-stone-200'
              : 'border-stone-200 dark:border-stone-600 hover:border-stone-400'}"
            title={t.sceneColorNone}
            on:click={() => (editSceneColorInput = '')}
          >
            <span class="text-xs text-stone-400">✕</span>
          </button>
          {#each SCENE_COLORS as c}
            <button
              type="button"
              class="h-9 w-9 rounded-lg border-2 transition {editSceneColorInput === c
                ? 'border-stone-800 dark:border-stone-200 scale-110'
                : 'border-transparent hover:scale-105'}"
              style="background-color: {c}"
              aria-label={c}
              on:click={() => (editSceneColorInput = editSceneColorInput === c ? '' : c)}
            />
          {/each}
          <label class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 hover:border-stone-400">
            <input
              type="color"
              class="sr-only"
              value={editSceneColorInput || '#888888'}
              on:input={(e) => (editSceneColorInput = e.currentTarget.value)}
            />
            <span class="text-xs text-stone-500">+</span>
          </label>
        </div>
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <button
          type="button"
          class="w-full rounded-xl border border-stone-200 dark:border-stone-600 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-50 dark:hover:bg-stone-700"
          on:click={replaceSceneWithCurrent}
        >
          {t.sceneReplaceWithCurrent}
        </button>
      </div>
      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-xl bg-stone-100 dark:bg-stone-700 py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-200 dark:hover:bg-stone-600 active:scale-[0.98]"
          on:click={() => (showEditSceneModal = null)}
        >
          {t.close}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]"
          on:click={saveSceneEdit}
        >
          {t.settingsSave}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteSceneConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-scene-title"
  >
    <div class="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg">
      <h2 id="delete-scene-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
        {t.sceneDelete}
      </h2>
      <p class="mt-2 text-sm text-stone-600 dark:text-stone-400">
        {t.sceneDeleteConfirm(showDeleteSceneConfirm.name)}
      </p>
      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-xl bg-stone-100 dark:bg-stone-700 py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-200 dark:hover:bg-stone-600 active:scale-[0.98]"
          on:click={() => (showDeleteSceneConfirm = null)}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-red-600 py-3 font-medium text-white transition hover:bg-red-700 active:scale-[0.98]"
          on:click={confirmDeleteScene}
        >
          {t.sceneDelete}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showPinSetupModal}
  <PinSetupModal
    mode={pinSetupMode}
    onClose={() => (showPinSetupModal = false)}
    onSuccess={() => (showPinSetupModal = false)}
  />
{/if}
