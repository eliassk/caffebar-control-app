<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";
  import {
    Coffee, Home, Lightbulb, BarChart3, Sun, Flame, Menu,
    Thermometer, Settings, Play,
  } from "lucide-svelte";
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
  import type { ClimateAttributes } from "$lib/types";
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
  import Modal from "$lib/Modal.svelte";
  import { groupLights } from "$lib/lightGroups";
  import { refreshChecklistState } from "$lib/checklistStore";
  import { SCENE_ICON_KEYS, SCENE_ICONS, SCENE_COLORS, getSceneIcon, safeColor } from "$lib/sceneHelpers";
  import OverviewView from "$lib/views/OverviewView.svelte";
  import SettingsView from "$lib/views/SettingsView.svelte";

  // ─── Polling & navigation constants ───────────────────────────────
  /** How often to poll entities (ms). Keeps UI in sync when SSE lags. */
  const POLL_MS = 3000;
  type View = "overview" | "lighting" | "temperature" | "hvac" | "settings";

  // ─── Shared state ─────────────────────────────────────────────────
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
  let settingsUnlocked = false;
  let appVersion = "";
  let openSettingsScrollToChecklist = false;

  // Scene modal state
  let showSaveSceneModal = false;
  let saveSceneNameInput = "";
  let saveSceneIconInput = "";
  let saveSceneColorInput = "";
  let showEditSceneModal: Scene | null = null;
  let editSceneNameInput = "";
  let editSceneIconInput = "";
  let editSceneColorInput = "";
  let showDeleteSceneConfirm: Scene | null = null;

  // ─── Derived entity groups ────────────────────────────────────────
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

  /** Detect floor-warming climate entities by id/name keywords. */
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

  /** Derive a human-readable HVAC state label for badges. */
  function deriveHvacState(entity: CoffeeEntity | null): string | null | undefined {
    if (!entity) return null;
    const attrs = entity.attributes as ClimateAttributes;
    if (Array.isArray(attrs.preset_modes) && attrs.preset_modes.length > 0) {
      const p = String(attrs.preset_mode ?? "").trim();
      return p === "none" || p === "" ? t.modeOff : attrs.preset_mode;
    }
    if (entity.state === "off") return t.modeOff;
    if (entity.state === "auto") return t.modeAuto;
    if (entity.state === "optimal") return t.modeOptimal;
    if (entity.state === "comfort") return t.modeComfort;
    return entity.state;
  }
  $: hvacState = deriveHvacState(primaryHvac);
  $: hvacTargetTemp = primaryHvac && typeof (primaryHvac.attributes as ClimateAttributes)?.temperature === "number"
    ? (primaryHvac.attributes as ClimateAttributes).temperature ?? null : null;
  $: floorIsOn = primaryFloor && ((primaryFloor.attributes as ClimateAttributes).hvac_action === "heating" || primaryFloor.state === "heat" || primaryFloor.state === "heating");
  $: floorTargetTemp = primaryFloor && typeof (primaryFloor.attributes as ClimateAttributes)?.temperature === "number"
    ? (primaryFloor.attributes as ClimateAttributes).temperature ?? null : null;

  // ─── View flags ───────────────────────────────────────────────────
  $: showMotionAndOther = view === "temperature";
  $: showClimate = view === "hvac";
  $: showLights = view === "lighting";
  $: showPower = view === "lighting";
  $: showTempView = view === "temperature";
  $: showOverviewWelcome = view === "overview";
  $: showSettings = view === "settings";
  $: if (view !== "settings") settingsUnlocked = false;
  $: if (showSettings && openSettingsScrollToChecklist) {
    openSettingsScrollToChecklist = false;
    setTimeout(() => document.getElementById("settings-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }
  $: lightGroups = groupLights(lights, lightGroupsConfig);

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Strip HTML-like error text so we don't render HA's HTML error pages. */
  function sanitizeError(msg: string): string {
    const trimmed = msg.trim();
    if (trimmed.length > 280 || trimmed.startsWith("<!") || trimmed.toLowerCase().includes("<html")) {
      return t.errorCannotReach;
    }
    return trimmed;
  }

  /** Check if a light supports brightness (dimmer or colour modes). */
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

  // ─── Data loading ─────────────────────────────────────────────────

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
      const { ok, demo_mode, version } = await healthCheck();
      online = ok;
      demoMode = demo_mode ?? false;
      if (version) appVersion = version;
      if (ok && lastError) load();
    } catch {
      online = false;
    }
  }

  onMount(() => {
    load();
    fetchLightGroupsConfig().then((cfg) => (lightGroupsConfig = cfg));
    loadScenesData();
    checkHealth();
    refreshChecklistState();
    const streamUnsub = subscribeEntitiesStream(
      (data) => { entities = data; lastError = null; online = true; },
      () => { /* stream error: fall back to polling */ }
    );
    const pollInterval = setInterval(load, POLL_MS);
    /** Health check interval — also detects demo mode and fetches version. */
    const healthInterval = setInterval(checkHealth, 10_000);
    /** Refresh checklist checked-state every minute (auto-resets hourly). */
    const checklistInterval = setInterval(refreshChecklistState, 60_000);
    return () => {
      streamUnsub();
      clearInterval(pollInterval);
      clearInterval(healthInterval);
      clearInterval(checklistInterval);
    };
  });

  // ─── Entity actions ───────────────────────────────────────────────

  async function toggle(entity: CoffeeEntity) {
    if (entity.domain !== "switch" && entity.domain !== "light") return;
    toggling = new Set(toggling);
    toggling.add(entity.entity_id);
    try {
      await toggleEntity(entity.entity_id);
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
      try { await toggleEntity(e.entity_id); }
      catch (err) { lastError = sanitizeError(err instanceof Error ? err.message : t.errorToggleFailed); }
    }
    const toTurnOffClimate = climate.filter((e) => e.state !== "off" && e.state !== "unavailable" && e.state !== "unknown");
    for (const e of toTurnOffClimate) {
      try {
        if (isFloorWarming(e)) {
          await callService("climate", "set_hvac_mode", e.entity_id, { hvac_mode: "off" });
        } else {
          await callService("climate", "turn_off", e.entity_id);
        }
      } catch (err) { lastError = sanitizeError(err instanceof Error ? err.message : t.errorToggleFailed); }
    }
  }

  async function allOff() {
    await turnOffLightsSwitchesAndHvac();
    showAllOffConfirm = false;
    await load();
  }

  // ─── Scene actions ────────────────────────────────────────────────

  async function loadScenesData() {
    try { scenes = await fetchScenes(); }
    catch { scenes = []; }
  }

  /** Capture the current light state for saving as a new scene. */
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
    try { await applyScene(scene.id); }
    catch (e) { lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed); await load(); }
    finally { sceneBusy = null; }
  }

  function openSaveSceneModal() {
    saveSceneNameInput = "";
    saveSceneIconInput = "";
    saveSceneColorInput = "";
    showSaveSceneModal = true;
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
      await loadScenesData();
    } catch (e) { lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed); }
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
      await loadScenesData();
    } catch (e) { lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed); }
  }

  async function replaceSceneWithCurrent() {
    if (!showEditSceneModal) return;
    try {
      await updateScene(showEditSceneModal.id, { entities: captureCurrentState() });
      showEditSceneModal = null;
      await loadScenesData();
    } catch (e) { lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed); }
  }

  async function confirmDeleteScene() {
    if (!showDeleteSceneConfirm) return;
    const id = showDeleteSceneConfirm.id;
    showDeleteSceneConfirm = null;
    try { await deleteScene(id); await loadScenesData(); }
    catch (e) { lastError = sanitizeError(e instanceof Error ? e.message : t.errorSceneFailed); }
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════════
     LAYOUT
     ═══════════════════════════════════════════════════════════════════ -->
<div class="flex h-dvh bg-transparent">
  <!-- Backdrop when sidebar open on small screens -->
  <button
    type="button"
    class="fixed inset-0 z-30 bg-black/40 dark:bg-black/60 transition-opacity lg:hidden {sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}"
    aria-label={t.navMenuClose}
    on:click={() => (sidebarOpen = false)}
  />

  <!-- Sidebar -->
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-52 shrink-0 flex-col border-r border-white/20 dark:border-stone-600/50 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl py-5 pl-4 pr-3 shadow-glass transition-transform duration-200 ease-out lg:relative lg:translate-x-0 lg:shadow-none {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
  >
    <div class="flex items-center gap-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 dark:border-stone-500/50 bg-white/50 dark:bg-stone-700/50 backdrop-blur-md shadow-sm">
        <Coffee class="h-5 w-5 text-accent" />
      </div>
      <span class="font-display text-lg font-semibold text-stone-800 dark:text-stone-200">{t.appName}</span>
    </div>
    <nav class="mt-8 flex flex-1 flex-col gap-1">
      {#each [
        { key: "overview", icon: Home, label: t.navOverview },
        { key: "lighting", icon: Lightbulb, label: t.navLighting },
        { key: "temperature", icon: BarChart3, label: t.navTemperature },
        { key: "hvac", icon: Sun, label: t.navHvac },
      ] as item (item.key)}
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition {view === item.key
            ? 'border border-white/25 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 backdrop-blur-md text-accent shadow-sm'
            : 'border border-transparent text-stone-600 dark:text-stone-400 hover:bg-white/40 dark:hover:bg-stone-800/60 hover:text-stone-800 dark:hover:text-stone-200'}"
          on:click={() => { view = item.key; sidebarOpen = false; }}
        >
          <svelte:component this={item.icon} class="h-5 w-5 shrink-0" />
          {item.label}
        </button>
      {/each}
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
    <header class="flex shrink-0 items-center justify-between gap-4 border-b border-white/20 dark:border-stone-600/50 bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl px-4 py-3 sm:px-5">
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 dark:text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 lg:hidden"
        aria-label={sidebarOpen ? t.navMenuClose : t.navMenuOpen}
        on:click={() => (sidebarOpen = !sidebarOpen)}
      >
        <Menu class="h-6 w-6" />
      </button>
      <div class="ml-auto flex items-center gap-3">
        {#if appVersion}
          <span class="text-xs text-stone-500 dark:text-stone-400" title={t.settingsVersion}>v{appVersion}</span>
        {/if}
        {#if demoMode}
          <span class="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent">{t.demo}</span>
        {/if}
        <div
          class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm {online
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}"
        >
          <span class="h-2 w-2 rounded-full {online ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
          {online ? t.statusOnline : t.statusOffline}
        </div>
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

        <!-- ─── Overview ──────────────────────────────────────────── -->
        {#if showOverviewWelcome}
          <OverviewView
            {entities}
            {scenes}
            {sceneBusy}
            onRunScene={runScene}
            onBlackout={() => (showAllOffConfirm = true)}
            onOpenChecklistSettings={() => {
              view = "settings";
              sidebarOpen = false;
              openSettingsScrollToChecklist = true;
            }}
          />

        <!-- ─── Settings ──────────────────────────────────────────── -->
        {:else if showSettings}
          <SettingsView
            {scenes}
            {appVersion}
            bind:settingsUnlocked
            onOpenSaveSceneModal={openSaveSceneModal}
            onOpenEditSceneModal={openEditSceneModal}
            onDeleteScene={(scene) => (showDeleteSceneConfirm = scene)}
          />

        <!-- ─── Lighting / Temperature / HVAC ─────────────────────── -->
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

          <!-- Temperature view -->
          {#if showTempView && tempSensors.length > 0}
            <TemperatureGraphCard
              entityId={insideTempSensor?.entity_id ?? tempSensors[0].entity_id}
              secondaryEntityId={outsideTempEntity?.entity_id}
              title={t.graphTitle24h}
            />
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {#if insideTempSensor}
                <SensorTempCard entity={insideTempSensor} onSelect={() => (selectedTempEntity = insideTempSensor)} />
              {/if}
              {#if outsideTempEntity}
                <SensorTempCard entity={outsideTempEntity} onSelect={() => (selectedTempEntity = outsideTempEntity)} />
              {/if}
              {#each tempSensors.filter((e) => e !== insideTempSensor && e !== outsideTempSensor) as entity (entity.entity_id)}
                <SensorTempCard {entity} onSelect={() => (selectedTempEntity = entity)} />
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
                  <div class="grid items-start gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {#each groupLights as entity (entity.entity_id)}
                      <div class="col-span-2">
                        {#if isRGBWLight(entity)}
                          <LightRGBWCard
                            {entity}
                            onUpdate={load}
                            busy={toggling.has(entity.entity_id)}
                            onServiceCallStart={(id) => { toggling = new Set(toggling); toggling.add(id); toggling = toggling; }}
                            onServiceCallEnd={(id) => { toggling = new Set(toggling); toggling.delete(id); toggling = toggling; }}
                            onError={(msg) => (lastError = sanitizeError(msg))}
                          />
                        {:else if isDimmerLight(entity)}
                          <LightDimmerCard {entity} onUpdate={load} busy={toggling.has(entity.entity_id)} />
                        {:else}
                          <LightToggleCard {entity} onToggle={() => toggle(entity)} busy={toggling.has(entity.entity_id)} />
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            {/if}

            {#if showPower && switches.length > 0}
              {#each switches as entity (entity.entity_id)}
                <SwitchCard {entity} onToggle={() => toggle(entity)} busy={toggling.has(entity.entity_id)} />
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

<!-- ═══════════════════════════════════════════════════════════════════
     MODALS
     ═══════════════════════════════════════════════════════════════════ -->

{#if selectedTempEntity}
  <TemperatureDetailModal entity={selectedTempEntity} onClose={() => (selectedTempEntity = null)} />
{/if}

<!-- All-Off confirmation -->
<Modal open={showAllOffConfirm} titleId="alloff-title" onClose={() => (showAllOffConfirm = false)}>
  <h2 id="alloff-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">{t.turnAllOffTitle}</h2>
  <p class="mt-2 text-sm text-stone-600 dark:text-stone-400">{t.turnAllOffDesc}</p>
  <div class="mt-6 flex gap-3">
    <button type="button" class="flex-1 rounded-xl border border-white/20 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 backdrop-blur-sm py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-white/70 dark:hover:bg-stone-600/60 active:scale-[0.98]" on:click={() => (showAllOffConfirm = false)}>
      {t.cancel}
    </button>
    <button type="button" class="flex-1 rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]" on:click={allOff}>
      {t.turnAllOff}
    </button>
  </div>
</Modal>

<!-- Save scene -->
<Modal open={showSaveSceneModal} titleId="save-scene-title" onClose={() => (showSaveSceneModal = false)}>
  <h2 id="save-scene-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">{t.sceneSaveAs}</h2>
  <input type="text" bind:value={saveSceneNameInput} placeholder={t.sceneNamePlaceholder}
    class="mt-4 w-full rounded-xl border border-white/30 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
    on:keydown={(e) => e.key === "Enter" && saveSceneFromModal()} />
  <div class="mt-4">
    <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneIcon}</span>
    <div class="flex flex-wrap gap-2">
      {#each SCENE_ICON_KEYS as key}
        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-lg transition {saveSceneIconInput === key ? 'bg-accent text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'}" aria-label={key} on:click={() => (saveSceneIconInput = key)}>
          <svelte:component this={SCENE_ICONS[key]} class="h-4 w-4" />
        </button>
      {/each}
    </div>
  </div>
  <div class="mt-4">
    <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneColor}</span>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="h-9 w-9 rounded-lg border-2 transition {!saveSceneColorInput ? 'border-stone-800 dark:border-stone-200' : 'border-stone-200 dark:border-stone-600 hover:border-stone-400'}" title={t.sceneColorNone} on:click={() => (saveSceneColorInput = '')}>
        <span class="text-xs text-stone-400">✕</span>
      </button>
      {#each SCENE_COLORS as c}
        <button type="button" class="h-9 w-9 rounded-lg border-2 transition {saveSceneColorInput === c ? 'border-stone-800 dark:border-stone-200 scale-110' : 'border-transparent hover:scale-105'}" style="background-color: {c}" aria-label={c} on:click={() => (saveSceneColorInput = saveSceneColorInput === c ? '' : c)} />
      {/each}
      <label class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 hover:border-stone-400">
        <input type="color" class="sr-only" value={saveSceneColorInput || '#888888'} on:input={(e) => (saveSceneColorInput = e.currentTarget.value)} />
        <span class="text-xs text-stone-500">+</span>
      </label>
    </div>
  </div>
  <div class="mt-6 flex gap-3">
    <button type="button" class="flex-1 rounded-xl border border-white/20 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 backdrop-blur-sm py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-white/70 dark:hover:bg-stone-600/60 active:scale-[0.98]" on:click={() => (showSaveSceneModal = false)}>
      {t.cancel}
    </button>
    <button type="button" class="flex-1 rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50" disabled={!saveSceneNameInput.trim()} on:click={saveSceneFromModal}>
      {t.sceneSave}
    </button>
  </div>
</Modal>

<!-- Edit scene -->
{#if showEditSceneModal}
  <Modal open={true} titleId="edit-scene-title" onClose={() => (showEditSceneModal = null)}>
    <h2 id="edit-scene-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">{t.sceneEdit} — {showEditSceneModal.name}</h2>
    <input type="text" bind:value={editSceneNameInput} placeholder={t.sceneNamePlaceholder}
      class="mt-4 w-full rounded-xl border border-white/30 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 px-4 py-2.5 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
    <div class="mt-4">
      <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneIcon}</span>
      <div class="flex flex-wrap gap-2">
        {#each SCENE_ICON_KEYS as key}
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-lg transition {editSceneIconInput === key ? 'bg-accent text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'}" aria-label={key} on:click={() => (editSceneIconInput = key)}>
            <svelte:component this={SCENE_ICONS[key]} class="h-4 w-4" />
          </button>
        {/each}
      </div>
    </div>
    <div class="mt-4">
      <span class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">{t.sceneColor}</span>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="h-9 w-9 rounded-lg border-2 transition {!editSceneColorInput ? 'border-stone-800 dark:border-stone-200' : 'border-stone-200 dark:border-stone-600 hover:border-stone-400'}" title={t.sceneColorNone} on:click={() => (editSceneColorInput = '')}>
          <span class="text-xs text-stone-400">✕</span>
        </button>
        {#each SCENE_COLORS as c}
          <button type="button" class="h-9 w-9 rounded-lg border-2 transition {editSceneColorInput === c ? 'border-stone-800 dark:border-stone-200 scale-110' : 'border-transparent hover:scale-105'}" style="background-color: {c}" aria-label={c} on:click={() => (editSceneColorInput = editSceneColorInput === c ? '' : c)} />
        {/each}
        <label class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 hover:border-stone-400">
          <input type="color" class="sr-only" value={editSceneColorInput || '#888888'} on:input={(e) => (editSceneColorInput = e.currentTarget.value)} />
          <span class="text-xs text-stone-500">+</span>
        </label>
      </div>
    </div>
    <div class="mt-4 flex flex-col gap-2">
      <button type="button" class="w-full rounded-xl border border-white/20 dark:border-stone-600/50 bg-white/40 dark:bg-stone-700/40 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 transition hover:bg-white/60 dark:hover:bg-stone-600/50" on:click={replaceSceneWithCurrent}>
        {t.sceneReplaceWithCurrent}
      </button>
    </div>
    <div class="mt-6 flex gap-3">
      <button type="button" class="flex-1 rounded-xl border border-white/20 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 backdrop-blur-sm py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-white/70 dark:hover:bg-stone-600/60 active:scale-[0.98]" on:click={() => (showEditSceneModal = null)}>
        {t.close}
      </button>
      <button type="button" class="flex-1 rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]" on:click={saveSceneEdit}>
        {t.settingsSave}
      </button>
    </div>
  </Modal>
{/if}

<!-- Delete scene confirmation -->
{#if showDeleteSceneConfirm}
  <Modal open={true} titleId="delete-scene-title" onClose={() => (showDeleteSceneConfirm = null)}>
    <h2 id="delete-scene-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">{t.sceneDelete}</h2>
    <p class="mt-2 text-sm text-stone-600 dark:text-stone-400">{t.sceneDeleteConfirm(showDeleteSceneConfirm.name)}</p>
    <div class="mt-6 flex gap-3">
      <button type="button" class="flex-1 rounded-xl border border-white/20 dark:border-stone-600/50 bg-white/50 dark:bg-stone-700/50 backdrop-blur-sm py-3 font-medium text-stone-700 dark:text-stone-200 transition hover:bg-white/70 dark:hover:bg-stone-600/60 active:scale-[0.98]" on:click={() => (showDeleteSceneConfirm = null)}>
        {t.cancel}
      </button>
      <button type="button" class="flex-1 rounded-xl bg-red-600 py-3 font-medium text-white transition hover:bg-red-700 active:scale-[0.98]" on:click={confirmDeleteScene}>
        {t.sceneDelete}
      </button>
    </div>
  </Modal>
{/if}
