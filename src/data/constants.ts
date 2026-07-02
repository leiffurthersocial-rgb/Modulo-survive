/** World, physics and timing constants. Single source of truth. */

// --- Space ---
export const TILE = 16; // pixels per tile
export const CHUNK = 32; // tiles per chunk edge
export const WORLD_H = 512; // world height in tiles
export const WORLD_CH = WORLD_H / CHUNK; // chunk rows (16)

// --- Vertical strata (tile y, 0 = top of sky) ---
export const SURFACE_BASE = 200; // mean surface level
export const UNDERGROUND_Y = 240; // below: underground stratum
export const CAVERN_Y = 320; // below: cavern stratum
export const DEEP_Y = 430; // below: deep/magma stratum
export const WATER_TABLE = 285; // cheese caves below this partially flood
export const LAVA_LEVEL = 450; // cavities below this fill with lava

// --- Simulation ---
export const STEP = 1 / 60; // fixed simulation step (s)
export const GRAVITY = 32; // tiles/s^2
export const MAX_FALL = 42; // terminal velocity, tiles/s
export const FALL_HURT_SPEED = 26; // fall damage threshold, tiles/s
export const DAY_LENGTH = 1440; // seconds per full day/night cycle (24 min)
export const DAY_START = 0.28; // normalized time when the day begins at world start

// --- Streaming ---
export const LOAD_RADIUS_X = 3; // chunks loaded around camera horizontally
export const LOAD_RADIUS_Y = 2; // vertically
export const EVICT_MARGIN = 3; // extra ring kept before eviction

// --- Light ---
export const LIGHT_MAX = 15;
export const LIGHT_FALLOFF_AIR = 1;
export const LIGHT_FALLOFF_SOLID = 3;

// --- Inventory ---
export const HOTBAR_SLOTS = 10;
export const INV_ROWS = 4;
export const INV_SLOTS = HOTBAR_SLOTS * INV_ROWS;
export const ARMOR_SLOTS = 3; // head / chest / legs
export const ACCESSORY_SLOTS = 4;

// --- Persistence ---
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL = 60; // seconds

// --- Reach & interaction ---
export const REACH_TILES = 6.5;

// --- Player vitals ---
export const BASE_HP = 100;
export const BASE_MANA = 60;
export const BASE_STAMINA = 100;
export const BASE_HUNGER = 100;
