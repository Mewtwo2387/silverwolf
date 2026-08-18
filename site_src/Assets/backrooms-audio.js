// Backrooms — audio, synthesised entirely in the Web Audio API.
//
// No sound files: everything is oscillators, noise buffers and filters built at
// runtime. That keeps the page a code-only asset (nothing extra to serve or
// cache-bust) and lets sounds react continuously to game state — the hum
// detunes as tubes fail, the heartbeat tracks real proximity.
//
// Positional cues matter here because the whole game is about not knowing where
// something is: entity sounds go through PannerNodes with an HRTF panning model
// and inverse distance rolloff, so a Lifeform calling out from two corridors
// away actually tells you which way to run.
//
// Browsers suspend AudioContext until a user gesture, so start() must be called
// from a click/keypress — the game calls it when the player locks the pointer.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.7;
    this.nodes = {};
    this.noiseBuf = null;
    this.started = false;
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.started = true;
    this.ctx = new AC();
    const { ctx } = this;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(ctx.destination);

    // A shared 2 s noise buffer — regenerating noise per sound is pure waste.
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;

    if (ctx.listener.forwardX) {
      ctx.listener.forwardY.value = 0;
      ctx.listener.upX.value = 0;
      ctx.listener.upY.value = 1;
      ctx.listener.upZ.value = 0;
    }

    this.buildAmbience();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  /**
   * The bed: mains hum plus the room tone you only notice when it stops.
   * 60 Hz fundamental with a strong 120 Hz second harmonic is what a failing
   * fluorescent ballast actually sounds like; the buzz on top is band-passed
   * noise around 2.6 kHz for the tube's own fizz.
   */
  buildAmbience() {
    const { ctx } = this;
    const bus = ctx.createGain();
    bus.gain.value = 0.0;
    bus.connect(this.master);
    this.nodes.humBus = bus;

    const mk = (freq, gain, type = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(bus);
      o.start();
      return { o, g };
    };
    this.nodes.hum60 = mk(60, 0.16);
    this.nodes.hum120 = mk(120, 0.1, 'triangle');
    this.nodes.hum180 = mk(181.5, 0.035, 'sawtooth');

    // Tube fizz.
    const fizz = ctx.createBufferSource();
    fizz.buffer = this.noiseBuf;
    fizz.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 2.2;
    const fg = ctx.createGain();
    fg.gain.value = 0.05;
    fizz.connect(bp).connect(fg).connect(bus);
    fizz.start();
    this.nodes.fizzGain = fg;

    // Sub-bass room tone — the "somewhere a huge building is running" layer.
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuf;
    rumble.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 90;
    const rg = ctx.createGain();
    rg.gain.value = 0.5;
    rumble.connect(lp).connect(rg).connect(this.master);
    rumble.start();
    this.nodes.rumbleGain = rg;
  }

  /** Move the listener; `fwd` is the camera's forward vector. */
  setListener(pos, fwd) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x;
      l.forwardY.value = fwd.y;
      l.forwardZ.value = fwd.z;
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  /**
   * Hum loudness follows the nearest live fixture, so walking into a blackout
   * stretch drops the room into a silence that is far more unsettling than any
   * sting. `flicker` briefly detunes and swells it as a tube stutters.
   */
  updateAmbience(nearestLightDist, flicker) {
    if (!this.ctx) return;
    const near = clamp(1 - nearestLightDist / 16, 0, 1);
    const target = 0.05 + near * 0.32 + flicker * 0.3;
    const t = this.ctx.currentTime;
    this.nodes.humBus.gain.setTargetAtTime(target, t, 0.12);
    this.nodes.fizzGain.gain.setTargetAtTime(0.02 + near * 0.06 + flicker * 0.12, t, 0.08);
    if (this.nodes.hum120) {
      this.nodes.hum120.o.frequency.setTargetAtTime(120 + flicker * 6, t, 0.05);
    }
  }

  /**
   * Drop `node` out of the graph once `source` finishes. A PannerNode stays
   * alive for as long as it is connected to the master, so without this every
   * screech, mimic call and beam charge leaves one behind and the graph grows
   * for the whole session.
   */
  releaseWith(source, node) {
    if (!node || node === this.master) return;
    source.addEventListener('ended', () => node.disconnect(), { once: true });
  }

  panner(pos, refDist = 3, rolloff = 1.3) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = refDist;
    p.rolloffFactor = rolloff;
    p.maxDistance = 90;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.master);
    return p;
  }

  noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.playbackRate.value = 0.6 + Math.random() * 0.8;
    return s;
  }

  /** A muffled footfall on damp carpet — a filtered noise thump, not a click. */
  footstep(crouched, running) {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = crouched ? 420 : 900 + Math.random() * 300;
    const g = ctx.createGain();
    const peak = (crouched ? 0.05 : 0.14) * (running ? 1.5 : 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (crouched ? 0.1 : 0.16));
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.25);
  }

  /**
   * The PNG chaser's jumpscare screech: a descending FM squeal over a noise
   * burst. Loud on purpose, but still routed through the master volume so the
   * settings slider (and the mute toggle) genuinely govern it.
   */
  screech(pos) {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const dest = pos ? this.panner(pos, 6, 0.4) : this.master;

    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(2400, t);
    carrier.frequency.exponentialRampToValueAtTime(180, t + 1.1);
    const mod = ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.setValueAtTime(90, t);
    mod.frequency.exponentialRampToValueAtTime(700, t + 0.9);
    const modGain = ctx.createGain();
    modGain.gain.value = 900;
    mod.connect(modGain).connect(carrier.frequency);

    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(257);
    for (let i = 0; i < 257; i += 1) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 4);
    }
    dist.curve = curve;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.02);
    g.gain.setValueAtTime(0.85, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    carrier.connect(dist).connect(g).connect(dest);

    const burst = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.5, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    burst.connect(hp).connect(bg).connect(dest);

    carrier.start(t);
    mod.start(t);
    burst.start(t);
    carrier.stop(t + 1.35);
    mod.stop(t + 1.35);
    burst.stop(t + 1.35);
    this.releaseWith(carrier, dest);
  }

  /**
   * The Lifeform's lure — the wiki has it reusing victims' throats to mimic a
   * cry for help. Two formant band-passes over a wobbling sawtooth gets close
   * enough to "someone is calling you" without ever being a real word.
   */
  mimicCall(pos) {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const dest = this.panner(pos, 4, 1.1);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150 + Math.random() * 40, t);
    osc.frequency.linearRampToValueAtTime(105, t + 0.9);

    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 9;
    vib.connect(vibGain).connect(osc.frequency);

    const mix = ctx.createGain();
    mix.gain.value = 0.9;
    // Two vowel formants, swept — the "eeh-aah" that reads as a voice.
    [[720, 8], [1180, 10]].forEach(([f, q], i) => {
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.setValueAtTime(f, t);
      bq.frequency.linearRampToValueAtTime(f * (i ? 0.7 : 1.35), t + 0.85);
      bq.Q.value = q;
      osc.connect(bq).connect(mix);
    });

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.32, t + 0.14);
    env.gain.setValueAtTime(0.32, t + 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    mix.connect(env).connect(dest);

    osc.start(t);
    vib.start(t);
    osc.stop(t + 1.2);
    vib.stop(t + 1.2);
    this.releaseWith(osc, dest);
  }

  /** Entity 96 charging its beam: a rising resonant whine that means MOVE. */
  beamCharge(pos, seconds) {
    if (!this.ctx || !this.enabled) return null;
    const { ctx } = this;
    const t = ctx.currentTime;
    const dest = this.panner(pos, 5, 0.8);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1750, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + seconds * 0.7);
    osc.connect(g).connect(dest);
    osc.start(t);
    // A backstop stop, because the caller does not always get to call stop():
    // if the charge completes it kills you and the game tears down instead. A
    // later stop() overrides this one, so the explicit path still wins.
    osc.stop(t + seconds + 0.75);
    this.releaseWith(osc, dest);
    const stop = () => {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.stop(now + 0.2);
    };
    return { stop, panner: dest };
  }

  /** Electronic interference — Entity 96 corrupting whatever you're carrying. */
  interference(level) {
    if (!this.ctx) return;
    if (!this.nodes.interfGain) {
      const src = this.noiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.nodes.interfGain = g;
      this.nodes.interfFilter = bp;
    }
    const t = this.ctx.currentTime;
    this.nodes.interfGain.gain.setTargetAtTime(level * 0.22, t, 0.15);
    this.nodes.interfFilter.frequency.setTargetAtTime(900 + level * 2600, t, 0.2);
  }

  /** Heartbeat — a two-thump pulse whose rate rises with danger (0..1). */
  heartbeat(intensity) {
    if (!this.ctx || !this.enabled || intensity <= 0.02) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const thump = (at, gain) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(78, at);
      o.frequency.exponentialRampToValueAtTime(34, at + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + 0.28);
    };
    thump(t, 0.16 + intensity * 0.34);
    thump(t + 0.19, 0.1 + intensity * 0.24);
  }

  /** Low sustained dread while something is actively hunting you. */
  setDread(level) {
    if (!this.ctx) return;
    if (!this.nodes.dread) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 41;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = 41.7; // slight beat against the first
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(lp);
      o2.connect(lp);
      lp.connect(g).connect(this.master);
      o.start();
      o2.start();
      this.nodes.dread = g;
    }
    this.nodes.dread.gain.setTargetAtTime(clamp(level, 0, 1) * 0.16, this.ctx.currentTime, 0.4);
  }

  /** Win sting — the one moment the level lets go. */
  escape() {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    [220, 330, 440, 660].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const at = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.2, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + 1.7);
    });
  }

  /** Death sting — everything drops out and one low note holds. */
  death() {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 2.7);
    if (this.nodes.humBus) {
      this.nodes.humBus.gain.setTargetAtTime(0.0, t, 0.3);
    }
  }
}
