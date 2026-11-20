"use strict";

/*
 * Colour ramp for the frequency view: cool blue for streets run once, through
 * violet and pink to orange and yellow for the ones run most often.
 */

const FREQUENCY_RAMP = ["#4dabf7", "#7950f2", "#e64980", "#fd7e14", "#fcc419"];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const RAMP_RGB = FREQUENCY_RAMP.map(hexToRgb);

/** Colour at position `t` (0..1) along the ramp, as a CSS `rgb()` string. */
function rampColour(t) {
  const position = Math.min(Math.max(t, 0), 1) * (RAMP_RGB.length - 1);
  const index = Math.min(Math.floor(position), RAMP_RGB.length - 2);
  const mix = position - index;
  const [r, g, b] = RAMP_RGB[index].map((from, channel) =>
    Math.round(from + (RAMP_RGB[index + 1][channel] - from) * mix),
  );
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Colour for a street run `frequency` times, out of at most `maxFrequency`.
 * Log scale: the difference between 1 and 2 runs matters more than 19 vs 20.
 */
function frequencyColour(frequency, maxFrequency) {
  return rampColour(maxFrequency > 1 ? Math.log(frequency) / Math.log(maxFrequency) : 0);
}

/** CSS gradient showing the whole ramp, for the legend. */
function rampGradient() {
  return `linear-gradient(to right, ${FREQUENCY_RAMP.join(", ")})`;
}
