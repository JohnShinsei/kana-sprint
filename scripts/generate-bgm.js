const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const outputDir = path.join(__dirname, '..', 'assets', 'bgm');

function secondsToSamples(seconds) {
  return Math.floor(seconds * sampleRate);
}

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function sine(phase) {
  return Math.sin(phase);
}

function triangle(phase) {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

function square(phase) {
  return Math.sin(phase) >= 0 ? 1 : -1;
}

function saw(phase) {
  return 2 * (phase / (2 * Math.PI) - Math.floor(0.5 + phase / (2 * Math.PI)));
}

function softClip(value) {
  return Math.tanh(value * 1.15);
}

function envelope(position, length, attackSeconds = 0.012, releaseSeconds = 0.08) {
  const attack = Math.min(secondsToSamples(attackSeconds), Math.floor(length * 0.35));
  const release = Math.min(secondsToSamples(releaseSeconds), Math.floor(length * 0.55));

  if (position < attack) return position / Math.max(1, attack);
  if (position > length - release) return Math.max(0, (length - position) / Math.max(1, release));
  return 1;
}

function createBuffer(seconds) {
  return new Float32Array(secondsToSamples(seconds));
}

function addSynth(buffer, bpm, beat, beats, note, volume, tone = 'lead') {
  if (note === null) return;

  const start = secondsToSamples((60 / bpm) * beat);
  const length = secondsToSamples((60 / bpm) * beats);
  const frequency = midiToFrequency(note);

  for (let i = 0; i < length && start + i < buffer.length; i += 1) {
    const time = i / sampleRate;
    const phase = 2 * Math.PI * frequency * time;
    const pulsePhase = 2 * Math.PI * frequency * 1.006 * time;
    const release = tone === 'pad' ? 0.35 : tone === 'bass' ? 0.11 : 0.075;
    const env = envelope(i, length, tone === 'pad' ? 0.04 : 0.01, release);
    const damp = tone === 'pad' ? 1 : Math.exp(-time * (tone === 'bass' ? 1.6 : 2.4));
    let wave = 0;

    if (tone === 'lead') {
      wave = triangle(phase) * 0.52 + sine(phase * 2) * 0.18 + square(pulsePhase) * 0.12;
    } else if (tone === 'pluck') {
      wave = sine(phase) * 0.44 + triangle(phase * 2) * 0.3 + saw(pulsePhase) * 0.1;
    } else if (tone === 'bass') {
      wave = triangle(phase) * 0.58 + sine(phase * 0.5) * 0.22;
    } else {
      wave = sine(phase) * 0.5 + sine(phase * 1.005) * 0.22 + triangle(phase * 0.5) * 0.18;
    }

    buffer[start + i] += wave * volume * env * damp;
  }
}

function addPattern(buffer, bpm, notes, startBeat = 0, volume = 0.24, tone = 'lead') {
  let beat = startBeat;
  for (const [note, beats] of notes) {
    addSynth(buffer, bpm, beat, beats * 0.92, note, volume, tone);
    beat += beats;
  }
}

function addChord(buffer, bpm, beat, beats, notes, volume = 0.065) {
  for (const note of notes) {
    addSynth(buffer, bpm, beat, beats, note, volume, 'pad');
  }
}

function addKick(buffer, bpm, beat, volume = 0.34) {
  const start = secondsToSamples((60 / bpm) * beat);
  const length = secondsToSamples(0.18);

  for (let i = 0; i < length && start + i < buffer.length; i += 1) {
    const time = i / sampleRate;
    const frequency = 76 - time * 210;
    const phase = 2 * Math.PI * Math.max(38, frequency) * time;
    buffer[start + i] += sine(phase) * Math.exp(-time * 18) * volume;
  }
}

function addHat(buffer, bpm, beat, volume = 0.055) {
  const start = secondsToSamples((60 / bpm) * beat);
  const length = secondsToSamples(0.045);
  let seed = Math.floor(beat * 1009) + 17;

  for (let i = 0; i < length && start + i < buffer.length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    buffer[start + i] += noise * Math.exp(-(i / sampleRate) * 55) * volume;
  }
}

function addPercussion(buffer, bpm, bars, intensity = 1) {
  for (let beat = 0; beat < bars * 4; beat += 1) {
    if (beat % 4 === 0 || (intensity > 0.8 && beat % 4 === 2)) {
      addKick(buffer, bpm, beat, 0.28 * intensity);
    }
    addHat(buffer, bpm, beat + 0.5, 0.045 * intensity);
    if (intensity > 0.7) addHat(buffer, bpm, beat + 0.75, 0.028 * intensity);
  }
}

function addEcho(buffer, delaySeconds, amount) {
  const delay = secondsToSamples(delaySeconds);
  for (let i = delay; i < buffer.length; i += 1) {
    buffer[i] += buffer[i - delay] * amount;
  }
}

function normalize(buffer, peak = 0.82) {
  let max = 0;
  for (const sample of buffer) max = Math.max(max, Math.abs(sample));
  if (max === 0) return buffer;
  const gain = peak / max;
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = softClip(buffer[i] * gain);
  }
  return buffer;
}

function softenLoop(buffer) {
  const fade = secondsToSamples(0.06);
  for (let i = 0; i < fade; i += 1) {
    const value = i / fade;
    buffer[i] *= value;
    buffer[buffer.length - 1 - i] *= value;
  }
  addEcho(buffer, 0.24, 0.11);
  addEcho(buffer, 0.48, 0.055);
  return normalize(buffer);
}

function writeWav(filename, samples) {
  fs.mkdirSync(outputDir, { recursive: true });
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  });

  fs.writeFileSync(path.join(outputDir, filename), buffer);
}

function makeDojoRush() {
  const bpm = 132;
  const buffer = createBuffer(16 * (60 / bpm) * 4);
  const melody = [
    [76, 0.5], [79, 0.5], [81, 1], [79, 0.5], [76, 0.5], [74, 1],
    [72, 0.5], [74, 0.5], [76, 1], [79, 0.5], [81, 0.5], [83, 1],
    [81, 0.5], [79, 0.5], [76, 1], [74, 0.5], [72, 0.5], [71, 1],
    [72, 0.5], [74, 0.5], [76, 1], [79, 0.5], [76, 0.5], [74, 1],
  ];

  for (let beat = 0; beat < 64; beat += 4) {
    const chords = beat % 16 < 8 ? [48, 55, 60] : [50, 57, 62];
    addChord(buffer, bpm, beat, 4, chords, 0.048);
    addSynth(buffer, bpm, beat, 1.9, chords[0] - 12, 0.13, 'bass');
    addSynth(buffer, bpm, beat + 2, 1.9, chords[1] - 12, 0.11, 'bass');
  }

  addPattern(buffer, bpm, melody, 0, 0.19, 'lead');
  addPattern(buffer, bpm, melody.map(([note, beats]) => [note === null ? null : note - 12, beats]), 32, 0.13, 'pluck');
  addPercussion(buffer, bpm, 16, 0.95);
  return softenLoop(buffer);
}

function makeNeonFocus() {
  const bpm = 108;
  const buffer = createBuffer(16 * (60 / bpm) * 4);
  const motif = [
    [67, 0.5], [71, 0.5], [74, 1], [76, 1], [74, 1],
    [69, 0.5], [72, 0.5], [76, 1], [79, 1], [76, 1],
    [66, 0.5], [69, 0.5], [72, 1], [74, 1], [72, 1],
    [64, 0.5], [67, 0.5], [71, 1], [72, 1], [71, 1],
  ];

  for (let beat = 0; beat < 64; beat += 4) {
    const chord = beat % 16 < 8 ? [52, 59, 64] : [50, 57, 62];
    addChord(buffer, bpm, beat, 4, chord, 0.07);
    for (let step = 0; step < 8; step += 1) {
      addSynth(buffer, bpm, beat + step * 0.5, 0.42, chord[step % chord.length] + 12, 0.055, 'pluck');
    }
  }

  addPattern(buffer, bpm, motif, 8, 0.13, 'lead');
  addPattern(buffer, bpm, motif, 40, 0.11, 'lead');
  addPercussion(buffer, bpm, 16, 0.55);
  return softenLoop(buffer);
}

function makeStarlineNight() {
  const bpm = 96;
  const buffer = createBuffer(12 * (60 / bpm) * 4);
  const line = [
    [72, 1], [74, 1], [76, 2],
    [71, 1], [72, 1], [74, 2],
    [69, 1], [71, 1], [72, 1], [74, 1],
    [76, 2], [74, 2],
  ];

  for (let beat = 0; beat < 48; beat += 4) {
    const chord = beat % 12 === 0 ? [45, 52, 57] : beat % 12 === 4 ? [48, 55, 60] : [50, 57, 62];
    addChord(buffer, bpm, beat, 4, chord, 0.075);
    addSynth(buffer, bpm, beat, 3.8, chord[0] - 12, 0.09, 'bass');
    for (let step = 0; step < 4; step += 1) {
      addSynth(buffer, bpm, beat + step, 0.72, chord[step % chord.length] + 12, 0.048, 'pluck');
    }
  }

  addPattern(buffer, bpm, line, 4, 0.12, 'lead');
  addPattern(buffer, bpm, line.map(([note, beats]) => [note === null ? null : note - 12, beats]), 28, 0.085, 'pluck');
  addPercussion(buffer, bpm, 12, 0.36);
  return softenLoop(buffer);
}

function cleanOldWavs() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const file of fs.readdirSync(outputDir)) {
    if (file.endsWith('.wav')) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }
}

cleanOldWavs();
writeWav('dojo_rush_loop.wav', makeDojoRush());
writeWav('neon_focus_loop.wav', makeNeonFocus());
writeWav('starline_night_loop.wav', makeStarlineNight());

console.log('BGM regenerated.');
