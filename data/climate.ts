/**
 * Atmosphere layers: climate zones, pressure belts and prevailing winds.
 * All are simplified latitude bands mirrored into both hemispheres.
 */
import type { ClimateZone, PressureBelt, PressureKind, WindBelt } from '@/lib/types';

/**
 * Climate zones as simplified latitude bands. `range` is degrees from the Equator and is
 * mirrored into both hemispheres. labelLat: where the on-map label sits; labelLon is shared.
 */
export const CLIMATE_LABEL_LON = -38;
export const CLIMATE_NOTE = ' (Simplified band: real climates also depend on altitude, ocean currents and distance from the sea.)';
export const CLIMATE_ZONES: ClimateZone[] = [
  { name: 'Tropical', range: [0, 23.5], labelLat: 8, color: '#1f9d55', opacity: 0.24,
    desc: 'Warm year-round with little temperature change. Rainfall, not temperature, defines the seasons — wet and dry seasons. Home to rainforests, monsoon lands and savannas.' },
  { name: 'Arid / Subtropical', range: [15, 35], labelLat: 29, color: '#e0a416', opacity: 0.26,
    desc: 'Dry belt of hot deserts and steppes created by sinking air under the subtropical highs — for example the Sahara, Arabian, Kalahari, Atacama and Australian deserts. Overlaps the outer tropics between 15° and 23.5°.' },
  { name: 'Temperate', range: [35, 66.5], labelLat: 50, color: '#3b7ddd', opacity: 0.18,
    desc: 'Moderate temperatures with four distinct seasons. Weather is driven by the westerlies and travelling storm systems; includes Mediterranean, oceanic and continental climates.' },
  { name: 'Polar', range: [66.5, 90], labelLat: 78, color: '#8b7fd6', opacity: 0.24,
    desc: 'Very cold all year, with long dark winters and brief cool summers. Landscapes of ice caps and treeless tundra; precipitation is low.' }
];

/** Pressure belts (dashed bands). kind: 'low' or 'high'. */
export const PRESSURE_LABEL_LON = 85;
export const PRESSURE_STYLE: Record<PressureKind, { label: string; color: string }> = {
  low:  { label: 'Low-pressure belt',  color: '#7c3aed' },
  high: { label: 'High-pressure belt', color: '#b45309' }
};
export const PRESSURE_BELTS: PressureBelt[] = [
  { name: 'Equatorial Low', kind: 'low', range: [0, 5], labelLat: -2.6, coord: '≈ 5°S – 5°N',
    desc: 'Also called the doldrums or Intertropical Convergence Zone. Intense heating makes warm, moist air rise, producing clouds and heavy rain almost daily and light, variable winds.' },
  { name: 'Subtropical High', kind: 'high', range: [25, 35], labelLat: 30, coord: '≈ 25°–35° N and S (centred near 30°)',
    desc: 'The horse latitudes. Air that rose at the Equator sinks here, warming and drying as it descends — clear skies, little rain and most of the world\'s great deserts.' },
  { name: 'Subpolar Low', kind: 'low', range: [55, 65], labelLat: 60, coord: '≈ 55°–65° N and S (centred near 60°)',
    desc: 'Warm westerlies meet cold polar air along the polar front. The warmer air is forced to rise, generating frequent storms, cloud and precipitation.' },
  { name: 'Polar High', kind: 'high', range: [80, 90], labelLat: 85, coord: '≈ 80°–90° N and S',
    desc: 'Very cold, dense air sinks over the poles, producing high pressure, clear skies and cold, dry conditions — the polar regions are effectively cold deserts.' }
];

/**
 * Prevailing wind belts. `toward` gives the flow: 'west' = easterly winds blowing toward
 * the Equator and west; 'east' = westerly winds blowing toward the pole and east.
 */
export const WIND_STYLE = { color: '#0f766e', labelLon: 138, arrowLons: [-165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165], arrowHalfWidth: 9 };
export const WIND_BELTS: WindBelt[] = [
  { name: 'Trade Winds', range: [0, 30], toward: 'west', fromN: 'NE', fromS: 'SE', labelLat: 26.5,
    desc: 'Steady winds blowing east to west toward the Equator — from the north-east in the Northern Hemisphere and the south-east in the Southern. They carried sailing ships across the oceans and steer tropical storms westward.' },
  { name: 'Westerlies', range: [30, 60], toward: 'east', fromN: 'SW', fromS: 'NW', labelLat: 56.5,
    desc: 'Winds blowing west to east in the mid-latitudes. They move weather systems across the temperate zone and are strongest over the Southern Ocean (the "Roaring Forties").' },
  { name: 'Polar Easterlies', range: [60, 90], toward: 'west', fromN: 'NE', fromS: 'SE', labelLat: 63,
    desc: 'Cold, dry winds blowing east to west away from the polar highs. Where they meet the westerlies near 60° they form the stormy polar front.' }
];
