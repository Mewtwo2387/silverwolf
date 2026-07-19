// Plane Sim's soundtrack — three loopable orchestral themes (menu / combat /
// stunt), synthesised live with WebAudio so there are NO audio assets to host
// and the CSP (`script-src 'self'`, no media origins) stays untouched.
//
// The goal is a WWII war-film palette, NOT chiptune — so instead of raw square
// waves the voices are built the way you'd fake an orchestra on a synth:
//   • strings  — three detuned sawtooths per note through a lowpass, a slow
//                bow-swell envelope and a shared vibrato LFO (ensemble warmth);
//   • brass    — detuned saws with a *filter envelope* (the sweep that makes a
//                horn "bloom") plus a little tanh drive and vibrato;
//   • flute    — sine+triangle with a breath-noise layer, for lone-flute lines;
//   • timpani / bass drum / marching snare — pitched sine with a pitch-drop and
//                filtered-noise cadences, for the military pulse.
// The whole mix runs through a generated convolution reverb, which is what
// actually turns "synth" into "scoring stage".
//
// createMusicEngine(ctx, out) wires its output into `out` (the game's Music
// volume bus) and returns { start, stop, setTrack }. Tracks crossfade on the
// next bar so switching menu -> combat -> stunt never clicks.

export function createMusicEngine(ctx, out) {
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

  // --- Output chain: voices -> swap (crossfade) -> tone -> dry + reverb -> out.
  const swap = ctx.createGain();
  swap.gain.value = 0.0001;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 7800;
  tone.Q.value = 0.3;
  swap.connect(tone);
  const dry = ctx.createGain();
  dry.gain.value = 0.82;
  tone.connect(dry);
  dry.connect(out);
  // Convolution reverb from a generated exponentially-decaying-noise impulse —
  // a concert-hall tail is the single biggest step away from "arcade".
  const conv = ctx.createConvolver();
  (() => {
    const secs = 1.9;
    const len = (ctx.sampleRate * secs) | 0;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    conv.buffer = ir;
  })();
  const wet = ctx.createGain();
  wet.gain.value = 0.34;
  tone.connect(conv);
  conv.connect(wet);
  wet.connect(out);

  // Shared vibrato LFO (in cents) added to every voice's detune — the small
  // continuous pitch shimmer that keeps sustained notes from sounding dead.
  const vibOsc = ctx.createOscillator();
  vibOsc.type = 'sine';
  vibOsc.frequency.value = 5.1;
  const vib = ctx.createGain();
  vib.gain.value = 6; // ±6 cents
  vibOsc.connect(vib);
  vibOsc.start();

  // Half a second of white noise, reused for breath and percussion.
  const noise = ctx.createBuffer(1, (ctx.sampleRate * 0.5) | 0, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // Gentle saturation for brass edge (kept mild so it reads as horn, not buzz).
  const brassCurve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; brassCurve[i] = Math.tanh(1.3 * x); }

  // Attack / sustain / exponential-release envelope on a gain param.
  function env(param, t, dur, peak, atk, rel) {
    const s = t + Math.max(atk + 0.01, dur - rel);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + atk);
    param.setValueAtTime(peak, s);
    param.exponentialRampToValueAtTime(0.0004, t + dur);
  }

  // Bowed strings: detuned sawtooth ensemble, lowpass, slow swell + vibrato.
  function strings(freq, t, dur, gain, cutoff = 2600) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    env(g.gain, t, dur, gain, Math.min(0.22, dur * 0.3), Math.min(0.6, dur * 0.5));
    lp.connect(g);
    g.connect(swap);
    for (const c of [-8, 0, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = c;
      vib.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.12);
    }
  }
  const stringChord = (notes, t, dur, gain, cutoff) => { for (const n of notes) strings(mtof(n), t, dur, gain, cutoff); };

  // Brass / horn: detuned saws with a filter that blooms open on attack, a
  // touch of drive, and vibrato.
  function brass(freq, t, dur, gain) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(460, t);
    lp.frequency.linearRampToValueAtTime(2500, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(1350, t + Math.min(dur, 0.6));
    const sh = ctx.createWaveShaper();
    sh.curve = brassCurve;
    const g = ctx.createGain();
    env(g.gain, t, dur, gain, 0.05, Math.min(0.3, dur * 0.4));
    lp.connect(sh);
    sh.connect(g);
    g.connect(swap);
    for (const c of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = c;
      vib.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.12);
    }
  }

  // Lone flute: sine + soft triangle body + a breath-noise layer, with vibrato.
  function flute(freq, t, dur, gain) {
    const g = ctx.createGain();
    env(g.gain, t, dur, gain, 0.07, Math.min(0.22, dur * 0.4));
    g.connect(swap);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    vib.connect(o.detune);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.1);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    o2.connect(g2);
    g2.connect(g);
    o2.start(t);
    o2.stop(t + dur + 0.1);
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 2.2;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.14, t);
    ng.gain.exponentialRampToValueAtTime(0.0002, t + dur * 0.7);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(swap);
    n.start(t, Math.random() * 0.25, dur);
    n.stop(t + dur + 0.05);
  }

  // Timpani: tuned sine with a fast pitch-drop, a felt-mallet noise transient
  // and a long round decay.
  function timpani(freq, t, gain) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    o.connect(g);
    g.connect(swap);
    o.start(t);
    o.stop(t + 1);
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(lp);
    lp.connect(ng);
    ng.connect(swap);
    n.start(t, Math.random() * 0.2, 0.14);
    n.stop(t + 0.16);
  }
  function bassDrum(t, gain = 0.5) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g);
    g.connect(swap);
    o.start(t);
    o.stop(t + 0.2);
  }
  // Marching snare: a tight band of noise; `vel` shapes the cadence accents.
  function snare(t, vel) {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1900;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    n.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(swap);
    n.start(t, Math.random() * 0.2, 0.1);
    n.stop(t + 0.11);
  }

  // Chords (mid-octave triads; basses take the root an octave down).
  const Dm = [50, 53, 57];
  const Cc = [48, 52, 55];
  const Bb = [46, 50, 53];
  const Am = [45, 49, 52]; // A major (dominant of D minor)
  const Ff = [53, 57, 60];

  // Melodies: sparse maps of { 16th-step-within-the-8-bar-loop : midi note }.
  const MENU_MEL = {
    0: 69, 8: 65, 12: 67, 24: 69, 32: 72, 40: 69, 44: 65, 56: 62,
    64: 74, 72: 69, 76: 72, 88: 74, 96: 72, 104: 67, 108: 65, 120: 62,
  };
  const COMBAT_MEL = {
    0: 74, 4: 77, 8: 76, 12: 74, 16: 72, 24: 79, 28: 76,
    32: 74, 40: 70, 44: 74, 48: 73, 56: 69, 60: 73,
    64: 81, 68: 79, 72: 77, 80: 72, 88: 79, 92: 83,
    96: 82, 104: 74, 108: 70, 112: 69, 116: 73, 120: 74,
  };
  const STUNT_MEL = {
    0: 69, 4: 72, 8: 77, 16: 74, 24: 77, 28: 81,
    32: 70, 40: 77, 44: 74, 48: 72, 56: 79,
    64: 77, 72: 84, 80: 74, 88: 81, 96: 70, 104: 77, 112: 72, 120: 77,
  };

  const MENU = { // elegiac — soaring strings + a lone flute, distant timpani
    bpm: 72,
    bars: 8,
    chords: [Dm, Bb, Ff, Cc, Dm, Bb, Ff, Cc],
    parts: [
      (s, ch, bar, g, t, sec) => { if (s === 0) { stringChord(ch, t, sec(3.9), 0.05); strings(mtof(ch[2] + 12), t, sec(3.9), 0.028, 3400); } }, // string pad + shimmer octave
      (s, ch, bar, g, t, sec) => { if (s === 0) strings(mtof(ch[0] - 12), t, sec(3.9), 0.06, 1500); }, // cello
      (s, ch, bar, g, t, sec) => { const n = MENU_MEL[g]; if (n) flute(mtof(n), t, sec(1.6), 0.13); }, // lone-flute melody
      (s, ch, bar, g, t) => { if (s === 0 && (bar === 0 || bar === 4)) timpani(mtof(ch[0] - 12), t, 0.22); }, // distant timpani
    ],
  };
  const COMBAT = { // heroic brass march — timpani, bass drum, snare cadence
    bpm: 112,
    bars: 8,
    chords: [Dm, Cc, Bb, Am, Dm, Cc, Bb, Am],
    parts: [
      (s, ch, bar, g, t, sec) => { if (s === 0 || s === 8) brass(mtof(ch[0] - 12), t, sec(1.9), 0.09); }, // sustained low-brass foundation (beats 1 & 3)
      (s, ch, bar, g, t, sec) => { if (s === 0) stringChord(ch, t, sec(2.05), 0.04, 2000); }, // sustained string bed — the drive comes from the drums, not a repeated stab
      (s, ch, bar, g, t, sec) => { const n = COMBAT_MEL[g]; if (n) brass(mtof(n - 12), t, sec(0.9), 0.12); }, // heroic brass melody in warm horn register
      (s, ch, bar, g, t) => { if (s === 0 || s === 8) { timpani(mtof(ch[0] - 12), t, 0.5); bassDrum(t); } }, // martial low pulse
      (s, ch, bar, g, t) => { // snare cadence carries the march: soft 8ths, accents on 2 & 4, pickup roll
        if (s === 4 || s === 12) snare(t, 0.26);
        else if (s % 2 === 0) snare(t, 0.1);
        else if (s === 15) snare(t, 0.12);
      },
    ],
  };
  const STUNT = { // spirited adventure — bright brass + strings over a light march
    bpm: 120,
    bars: 8,
    chords: [Ff, Dm, Bb, Cc, Ff, Dm, Bb, Cc],
    parts: [
      (s, ch, bar, g, t, sec) => { if (s === 0) stringChord(ch, t, sec(1.85), 0.038, 3000); }, // sustained string bed
      (s, ch, bar, g, t, sec) => { // buoyant horn bass: root, then fifth — sustained, not stabbed
        if (s === 0) brass(mtof(ch[0] - 12), t, sec(1.4), 0.09);
        else if (s === 8) brass(mtof(ch[0] - 5), t, sec(1.0), 0.08);
      },
      (s, ch, bar, g, t, sec) => { const n = STUNT_MEL[g]; if (n) brass(mtof(n - 12), t, sec(0.62), 0.11); }, // brass melody in warm register
      (s, ch, bar, g, t) => { if (s === 0 || s === 8) bassDrum(t, 0.42); },
      (s, ch, bar, g, t) => { // lighter march snare
        if (s === 4 || s === 12) snare(t, 0.22);
        else if (s % 4 === 2) snare(t, 0.08);
      },
    ],
  };

  const tracks = { menu: MENU, combat: COMBAT, stunt: STUNT };
  let active = MENU;
  let pending = null;
  let step = 0;
  let nextTime = 0;
  let timer = null;

  const sec = (beats) => (beats * 60) / active.bpm;

  function playStep(gAbs, t) {
    const loopLen = active.bars * 16;
    const g = ((gAbs % loopLen) + loopLen) % loopLen;
    const bar = Math.floor(g / 16);
    const s = g % 16;
    const chord = active.chords[bar];
    for (const part of active.parts) part(s, chord, bar, g, t, sec);
  }

  function dip(t) {
    swap.gain.cancelScheduledValues(t);
    swap.gain.setValueAtTime(Math.max(swap.gain.value, 0.0001), t);
    swap.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
    swap.gain.exponentialRampToValueAtTime(1, t + 0.7);
  }

  function tick() {
    if (!timer) return;
    // If the interval was throttled (backgrounded tab) the clock can lurch far
    // ahead — resync instead of flushing a burst of past-due notes on return.
    if (nextTime < ctx.currentTime - 0.05) nextTime = ctx.currentTime + 0.06;
    while (nextTime < ctx.currentTime + 0.16) {
      // Switch tracks on a bar line, masked by a quick level dip.
      if (pending && step % 16 === 0) {
        active = pending;
        pending = null;
        step = 0;
        dip(nextTime);
      }
      playStep(step, nextTime);
      nextTime += (60 / active.bpm) / 4;
      step += 1;
    }
  }

  function start() {
    if (timer) return;
    nextTime = ctx.currentTime + 0.06;
    swap.gain.cancelScheduledValues(ctx.currentTime);
    swap.gain.setValueAtTime(Math.max(swap.gain.value, 0.0001), ctx.currentTime);
    swap.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
    timer = setInterval(tick, 25);
    tick();
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    try {
      swap.gain.cancelScheduledValues(ctx.currentTime);
      swap.gain.setValueAtTime(Math.max(swap.gain.value, 0.0001), ctx.currentTime);
      swap.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    } catch (_) { /* context torn down */ }
  }
  function setTrack(name) {
    const tr = tracks[name];
    if (!tr || tr === active) { if (tr === active) pending = null; return; }
    if (!timer) { active = tr; return; } // not running yet — start() will use it
    pending = tr;
  }

  return { start, stop, setTrack };
}
