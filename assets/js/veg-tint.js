// Colour tint for vegetation, per biome, so the plants match the ground they
// stand on. The savanna is dry: its plants take the colour of the dry grass
// texture they grow in (assets/images/dry.jpg).
//
// The tint is the mean pixel of that texture, converted to the linear space the
// shader multiplies in and scaled so its strongest channel is unchanged: it
// shifts the hue of a plant towards the ground colour without dimming it away.

export const VEG_TINT_SOURCE = {
  savanna: [108, 84, 52],
};

export function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function normalizedTint(rgb) {
  const lin = rgb.map(srgbToLinear);
  const m = Math.max(...lin);
  if (!(m > 0)) return [1, 1, 1];
  return lin.map((c) => c / m);
}

// null = this biome keeps the plant's own colours.
export function vegTint(name) {
  const src = VEG_TINT_SOURCE[name];
  return src ? normalizedTint(src) : null;
}
