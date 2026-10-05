/** Day & night layer settings. */

/**
 * Day & night layer.
 *
 * `nightBands` shade the night side in steps, from the edge of the shadow inward. Each band
 * starts where the Sun is `sunBelow` degrees under the horizon and adds `opacity` on top of the
 * bands before it — so the edge is a soft twilight and the middle of the night is darkest.
 * For a darker or lighter night, change these opacities (or `nightColor`).
 *
 * `jumps` are the quick buttons (day of the year, 1–365);
 * `playDaysPerSecond` is the speed of the "Play year" animation.
 */
export const SUN = {
  color: '#f59e0b',
  nightColor: '#040a1c',
  nightBands: [
    { sunBelow: 0,  opacity: 0.34 },   // sunset line (terminator)
    { sunBelow: 6,  opacity: 0.26 },   // end of civil twilight
    { sunBelow: 12, opacity: 0.24 },   // end of nautical twilight
    { sunBelow: 18, opacity: 0.20 }    // full night
  ],
  playDaysPerSecond: 24,
  jumps: [
    { label: 'Mar equinox', day: 79 }, { label: 'Jun solstice', day: 172 },
    { label: 'Sep equinox', day: 266 }, { label: 'Dec solstice', day: 355 }
  ]
};

/** Combined darkness (0–1) where all night bands overlap; used for the legend swatch. */
export const NIGHT_DARKNESS = 1 - SUN.nightBands.reduce((light, band) => light * (1 - band.opacity), 1);
