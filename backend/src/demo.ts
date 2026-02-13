import { isEntityAllowed } from "./allowlist.js";

export interface DemoState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

const DEMO_ENTITIES: DemoState[] = [
  // —— Switches (Power) - SwitchCard ——
  {
    entity_id: "switch.coffee_machine",
    state: "off",
    attributes: { friendly_name: "Coffee Machine", icon: "mdi:coffee-maker" },
  },
  {
    entity_id: "switch.coffee_grinder",
    state: "on",
    attributes: { friendly_name: "Coffee Grinder", icon: "mdi:grinder" },
  },
  // —— Sala (Room) ——
  { entity_id: "light.coffee_bar_sala_wiszace", state: "on", attributes: { friendly_name: "Sala: Wiszące", icon: "mdi:ceiling-light" } },
  { entity_id: "light.coffee_bar_sala_szyny", state: "off", attributes: { friendly_name: "Sala: Szyny", icon: "mdi:track-light" } },
  {
    entity_id: "light.coffee_bar_sala_spoty",
    state: "on",
    attributes: { friendly_name: "Sala: Spoty", icon: "mdi:spotlight-beam", brightness: 180 },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_all",
    state: "on",
    attributes: {
      friendly_name: "Sala: Kaseton All",
      icon: "mdi:led-strip-variant",
      brightness: 200,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 200,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_all_rgbw",
    state: "on",
    attributes: {
      friendly_name: "Kaseton All RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 200,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 200,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_gr_1_rgbw",
    state: "on",
    attributes: {
      friendly_name: "Kaseton gr 1 RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 180,
      rgb_color: [255, 200, 150],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_gr_2_rgbw",
    state: "on",
    attributes: {
      friendly_name: "Kaseton gr 2 RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 180,
      rgb_color: [255, 200, 150],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_gr_3_rgbw",
    state: "off",
    attributes: {
      friendly_name: "Kaseton gr 3 RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_gr_4_rgbw",
    state: "off",
    attributes: {
      friendly_name: "Kaseton gr 4 RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_gr_5_rgbw",
    state: "off",
    attributes: {
      friendly_name: "Kaseton gr 5 RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.kaffebar_kaseton_gr_6_rgbw",
    state: "off",
    attributes: {
      friendly_name: "Kaseton gr 6 RGBW",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_gr_1",
    state: "on",
    attributes: {
      friendly_name: "Sala: Kaseton gr 1",
      icon: "mdi:led-strip-variant",
      brightness: 180,
      rgb_color: [255, 200, 150],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_gr_2",
    state: "on",
    attributes: {
      friendly_name: "Sala: Kaseton gr 2",
      icon: "mdi:led-strip-variant",
      brightness: 180,
      rgb_color: [255, 200, 150],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_gr_3",
    state: "off",
    attributes: {
      friendly_name: "Sala: Kaseton gr 3",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_gr_4",
    state: "off",
    attributes: {
      friendly_name: "Sala: Kaseton gr 4",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_gr_5",
    state: "off",
    attributes: {
      friendly_name: "Sala: Kaseton gr 5",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  {
    entity_id: "light.coffee_bar_sala_kaseton_gr_6",
    state: "off",
    attributes: {
      friendly_name: "Sala: Kaseton gr 6",
      icon: "mdi:led-strip-variant",
      brightness: 0,
      rgb_color: [255, 255, 255],
      color_temp: 370,
      white_value: 0,
    },
  },
  // —— Bar ——
  {
    entity_id: "light.coffee_bar_bar_spoty",
    state: "on",
    attributes: { friendly_name: "Bar: Spoty", icon: "mdi:spotlight-beam", brightness: 180 },
  },
  {
    entity_id: "light.coffee_bar_bar_dekoracyjne",
    state: "on",
    attributes: { friendly_name: "Bar: Dekoracyjne", icon: "mdi:string-lights" },
  },
  {
    entity_id: "light.coffee_bar_bar_glowne",
    state: "on",
    attributes: { friendly_name: "Bar: Główne", icon: "mdi:ceiling-light", brightness: 220 },
  },
  {
    entity_id: "light.coffee_bar_bar_zaplecze_ekspresu",
    state: "on",
    attributes: { friendly_name: "Bar: Zaplecze Ekspresu", icon: "mdi:coffee-maker", brightness: 150 },
  },
  // —— Zaplecze (Back) ——
  {
    entity_id: "light.coffee_bar_zaplecze_wejscie",
    state: "on",
    attributes: { friendly_name: "Zaplecze: Wejście", icon: "mdi:door-open", brightness: 200 },
  },
  {
    entity_id: "light.coffee_bar_zaplecze_zmywak",
    state: "off",
    attributes: { friendly_name: "Zaplecze: Zmywak", icon: "mdi:water-pump", brightness: 0 },
  },
  // —— Climate floor warming (FloorWarmingCard) ——
  {
    entity_id: "climate.coffee_bar_floor",
    state: "heat",
    attributes: {
      friendly_name: "Ogrzewanie podłogowe",
      icon: "mdi:radiator",
      current_temperature: 23,
      temperature: 24,
      min_temp: 18,
      max_temp: 28,
      hvac_action: "heating",
      unit_of_measurement: "°C",
    },
  },
  // —— Climate (ClimateCard) - AHU with preset_modes ——
  {
    entity_id: "climate.coffee_bar",
    state: "auto",
    attributes: {
      friendly_name: "HVAC",
      icon: "mdi:air-conditioner",
      current_temperature: 21,
      temperature: 22,
      min_temp: 16,
      max_temp: 30,
      hvac_modes: ["off", "auto"],
      preset_modes: ["Comfort", "Standby", "Night", "Eco"],
      preset_mode: "Comfort",
      hvac_action: "heating",
      unit_of_measurement: "°C",
    },
  },
  // —— Sensors: temperature (SensorTempCard) ——
  {
    entity_id: "sensor.coffee_bar_temperature",
    state: "21.5",
    attributes: {
      friendly_name: "Room Temperature",
      icon: "mdi:thermometer",
      device_class: "temperature",
      unit_of_measurement: "°C",
    },
  },
  // —— Weather (outside temp from HA weather entity) ——
  {
    entity_id: "weather.forecast_home",
    state: "partlycloudy",
    attributes: {
      friendly_name: "Forecast Home",
      icon: "mdi:weather-partly-cloudy",
      temperature: 8.2,
      unit_of_measurement: "°C",
    },
  },
];

const state = new Map<string, DemoState>(
  DEMO_ENTITIES.map((e) => [e.entity_id, { ...e, attributes: { ...e.attributes } }])
);

function clone(e: DemoState): DemoState {
  return {
    entity_id: e.entity_id,
    state: e.state,
    attributes: { ...e.attributes },
  };
}

export function getDemoStates(): DemoState[] {
  return DEMO_ENTITIES.filter((e) => isEntityAllowed(e.entity_id))
    .map((e) => state.get(e.entity_id) ?? e)
    .map(clone);
}

export function getDemoState(entityId: string): DemoState | null {
  if (!isEntityAllowed(entityId)) return null;
  const e = state.get(entityId);
  return e ? clone(e) : null;
}

export function demoCallService(
  domain: string,
  service: string,
  data?: { entity_id?: string | string[]; [key: string]: unknown }
): void {
  const ids =
    data?.entity_id != null
      ? Array.isArray(data.entity_id)
        ? data.entity_id
        : [data.entity_id]
      : [];
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const e = state.get(id);
    if (!e) continue;
    if (domain === "switch" || domain === "light") {
      if (service === "toggle") {
        e.state = e.state === "on" ? "off" : "on";
      } else if (service === "turn_on") {
        e.state = "on";
        const attrs = e.attributes as Record<string, unknown>;
        if (typeof data?.brightness === "number") attrs.brightness = data.brightness;
        if (Array.isArray(data?.rgb_color)) attrs.rgb_color = data.rgb_color;
        if (typeof data?.color_temp === "number") attrs.color_temp = data.color_temp;
        if (typeof data?.white_value === "number") attrs.white_value = data.white_value;
      } else if (service === "turn_off") {
        e.state = "off";
      }
    }
    if (domain === "climate") {
      const attrs = e.attributes as Record<string, unknown>;
      if (service === "turn_off") {
        e.state = "off";
      } else if (service === "set_temperature" && typeof data?.temperature === "number") {
        attrs.temperature = data.temperature;
      } else if (service === "set_hvac_mode" && typeof data?.hvac_mode === "string") {
        e.state = data.hvac_mode;
      } else if (service === "set_preset_mode" && typeof data?.preset_mode === "string") {
        (e.attributes as Record<string, unknown>).preset_mode = data.preset_mode;
      }
    }
  }
}

export function getDemoHistory(
  entityId: string,
  hours: number
): Array<{ timestamp: string; value: number }> {
  const e = state.get(entityId);
  const domain = entityId.split(".")[0];
  let base = 21;
  if (e) {
    if (domain === "weather") {
      const temp = (e.attributes as Record<string, unknown>)?.temperature;
      base = typeof temp === "number" ? temp : parseFloat(String(temp ?? "21")) || 21;
    } else {
      base = parseFloat(e.state) || 21;
    }
  }
  const now = Date.now();
  const stepMs = 30 * 60 * 1000; // 30 min
  const points: Array<{ timestamp: string; value: number }> = [];
  for (let t = now - hours * 60 * 60 * 1000; t <= now; t += stepMs) {
    const x = (t - (now - hours * 60 * 60 * 1000)) / (hours * 60 * 60 * 1000);
    const variation = Math.sin(x * Math.PI * 4) * 1.5 + (Math.random() - 0.5) * 1;
    points.push({
      timestamp: new Date(t).toISOString(),
      value: Math.round((base + variation) * 10) / 10,
    });
  }
  return points;
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1";
}
