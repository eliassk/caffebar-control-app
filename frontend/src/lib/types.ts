/**
 * Typed attribute interfaces for Home Assistant entities.
 *
 * These replace the generic `Record<string, unknown>` casts used
 * throughout the frontend and make property access type-safe.
 */

/** Common attributes shared by all entities. */
export interface BaseAttributes {
  friendly_name?: string;
  icon?: string;
  device_class?: string;
  unit_of_measurement?: string;
}

/** Attributes specific to light entities. */
export interface LightAttributes extends BaseAttributes {
  brightness?: number;
  rgb_color?: [number, number, number];
  color_temp?: number;
  white_value?: number;
  supported_color_modes?: string[];
}

/** Attributes specific to climate entities. */
export interface ClimateAttributes extends BaseAttributes {
  temperature?: number;
  current_temperature?: number;
  hvac_action?: string;
  hvac_mode?: string;
  hvac_modes?: string[];
  preset_mode?: string;
  preset_modes?: string[];
}

/** Attributes specific to weather entities. */
export interface WeatherAttributes extends BaseAttributes {
  temperature?: number;
  humidity?: number;
  pressure?: number;
  wind_speed?: number;
}

/** Attributes specific to sensor entities. */
export interface SensorAttributes extends BaseAttributes {
  state_class?: string;
}

/**
 * Type-safe attribute accessor.
 *
 * Usage:
 * ```ts
 * const attrs = entity.attributes as LightAttributes;
 * if (attrs.brightness != null) { ... }
 * ```
 */
export type EntityAttributes =
  | LightAttributes
  | ClimateAttributes
  | WeatherAttributes
  | SensorAttributes
  | BaseAttributes;
