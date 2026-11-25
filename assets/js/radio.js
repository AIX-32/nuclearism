// Held radio: which clip to play, and how long until the scheduled strike.
export const RADIO_STATIC = 'assets/audio/radio/static.mp3';
export const RADIO_SIGNAL = 'assets/audio/radio/websdr.wav';
export const RADIO_CUTOFF = 180; // seconds before impact that the signal cuts to static

export function nextStrikeDay(fromDay, interval) {
  const step = interval || 10;
  return (Math.floor(Math.max(0, fromDay) / step) + 1) * step;
}

export function secondsUntilStrike(clock, nextNukeDay, daySeconds) {
  return (nextNukeDay - clock.day) * daySeconds - clock.t;
}

export function radioTrack(heldId, willHit, secondsLeft) {
  if (heldId !== 'radio') return null;
  return willHit && secondsLeft > RADIO_CUTOFF ? RADIO_SIGNAL : RADIO_STATIC;
}
