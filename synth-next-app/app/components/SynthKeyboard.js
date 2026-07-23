'use client';

import { useEffect, useRef, useState } from 'react';

const NOTE_DEFS = [
  { letter: 'A', note: 'C4',  freq: 261.63, type: 'white' },
  { letter: 'W', note: 'C#4', freq: 277.18, type: 'black', after: 0 },
  { letter: 'S', note: 'D4',  freq: 293.66, type: 'white' },
  { letter: 'E', note: 'D#4', freq: 311.13, type: 'black', after: 2 },
  { letter: 'D', note: 'E4',  freq: 329.63, type: 'white' },
  { letter: 'F', note: 'F4',  freq: 349.23, type: 'white' },
  { letter: 'T', note: 'F#4', freq: 369.99, type: 'black', after: 5 },
  { letter: 'G', note: 'G4',  freq: 392.00, type: 'white' },
  { letter: 'Y', note: 'G#4', freq: 415.30, type: 'black', after: 7 },
  { letter: 'H', note: 'A4',  freq: 440.00, type: 'white' },
  { letter: 'U', note: 'A#4', freq: 466.16, type: 'black', after: 9 },
  { letter: 'J', note: 'B4',  freq: 493.88, type: 'white' },
  { letter: 'K', note: 'C5',  freq: 523.25, type: 'white' },
];

const WHITE_KEYS = NOTE_DEFS.filter((n) => n.type === 'white');
const BLACK_KEYS = NOTE_DEFS.filter((n) => n.type === 'black');
const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
const WAVE_LABELS = { sine: 'Sine', triangle: 'Tri', square: 'Square', sawtooth: 'Saw' };

// Easter egg: holding J plays the Mario theme instead of its note.
const MARIO_FREQS = {
  E5: 659.25, C5: 523.25, G5: 783.99, G4: 392.00,
  A4: 440.00, B4: 493.88, Bb4: 466.16, A5: 880.00, F5: 698.46,
  E4: 329.63, D5: 587.33,
};
const MARIO_SONG = [
  ['E5', 1], ['E5', 1], [0, 1], ['E5', 1], [0, 1], ['C5', 1], ['E5', 1], [0, 1],
  ['G5', 1], [0, 1], [0, 1], [0, 1], ['G4', 1], [0, 1], [0, 1], [0, 1],
  ['C5', 1], [0, 1], [0, 1], ['G4', 1], [0, 1], [0, 1], ['E4', 1], [0, 1], [0, 1],
  ['A4', 1], [0, 1], ['B4', 1], [0, 1], ['Bb4', 1], ['A4', 1], [0, 1],
  ['G4', 0.66], ['E5', 0.66], ['G5', 0.66], ['A5', 1], [0, 1], ['F5', 1], ['G5', 1], [0, 1],
  [0, 1], ['E5', 1], [0, 1], ['C5', 1], ['D5', 1], ['B4', 1], [0, 1], [0, 1],
];
const MARIO_BEAT_MS = 130;

export default function SynthKeyboard() {
  const keysRef = useRef(null);
  const canvasRef = useRef(null);
  const lastNoteRef = useRef(null);
  const keyElRefs = useRef({});

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const analyserRef = useRef(null);
  const activeVoicesRef = useRef({});

  const marioActiveRef = useRef(false);
  const marioStepRef = useRef(0);
  const marioTimeoutRef = useRef(null);
  const marioVoiceRef = useRef(null);

  const [currentWave, setCurrentWave] = useState('sine');
  const currentWaveRef = useRef('sine');
  useEffect(() => {
    currentWaveRef.current = currentWave;
  }, [currentWave]);

  // Position the black keys over the white keys once we know the container width.
  useEffect(() => {
    function positionBlackKeys() {
      const container = keysRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth - 16;
      const whiteWidth = containerWidth / WHITE_KEYS.length;
      BLACK_KEYS.forEach((def) => {
        const el = keyElRefs.current[def.letter];
        if (!el) return;
        const leftPx = 8 + (def.after + 1) * whiteWidth - whiteWidth * 0.31;
        el.style.left = leftPx + 'px';
      });
    }
    positionBlackKeys();
    window.addEventListener('resize', positionBlackKeys);
    return () => window.removeEventListener('resize', positionBlackKeys);
  }, []);

  function ensureAudio() {
    if (audioCtxRef.current) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    audioCtxRef.current = audioCtx;
    masterGainRef.current = masterGain;
    analyserRef.current = analyser;
  }

  function stopMarioVoice() {
    const audioCtx = audioCtxRef.current;
    const voice = marioVoiceRef.current;
    if (!voice || !audioCtx) return;
    const { osc, gain } = voice;
    const now = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);
    osc.stop(now + 0.06);
    marioVoiceRef.current = null;
  }

  function playMarioStep() {
    if (!marioActiveRef.current) return;
    const audioCtx = audioCtxRef.current;
    const [note, beats] = MARIO_SONG[marioStepRef.current % MARIO_SONG.length];
    const durSec = (beats * MARIO_BEAT_MS) / 1000;

    stopMarioVoice();

    if (note) {
      const freq = MARIO_FREQS[note];
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.9, now + 0.01);
      gain.gain.setValueAtTime(0.9, now + Math.max(0.011, durSec - 0.04));
      gain.gain.linearRampToValueAtTime(0, now + durSec);
      osc.connect(gain);
      gain.connect(masterGainRef.current);
      osc.start();
      osc.stop(now + durSec + 0.02);
      marioVoiceRef.current = { osc, gain };
      if (lastNoteRef.current) lastNoteRef.current.textContent = note;
    }

    marioStepRef.current += 1;
    marioTimeoutRef.current = setTimeout(playMarioStep, durSec * 1000);
  }

  function marioOn() {
    if (marioActiveRef.current) return;
    ensureAudio();
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    marioActiveRef.current = true;
    marioStepRef.current = 0;
    const el = keyElRefs.current['J'];
    if (el) el.classList.add('pressed');
    playMarioStep();
  }

  function marioOff() {
    if (!marioActiveRef.current) return;
    marioActiveRef.current = false;
    clearTimeout(marioTimeoutRef.current);
    stopMarioVoice();
    const el = keyElRefs.current['J'];
    if (el) el.classList.remove('pressed');
  }

  function noteOn(def) {
    if (!def) return;
    if (def.letter === 'J') {
      marioOn();
      return;
    }
    if (activeVoicesRef.current[def.letter]) return;
    ensureAudio();
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = currentWaveRef.current;
    osc.frequency.value = def.freq;

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.9, now + 0.012);

    osc.connect(gain);
    gain.connect(masterGainRef.current);
    osc.start();

    activeVoicesRef.current[def.letter] = { osc, gain };
    const el = keyElRefs.current[def.letter];
    if (el) el.classList.add('pressed');
    if (lastNoteRef.current) lastNoteRef.current.textContent = def.note;
  }

  function noteOff(def) {
    if (!def) return;
    if (def.letter === 'J') {
      marioOff();
      return;
    }
    const el = keyElRefs.current[def.letter];
    if (el) el.classList.remove('pressed');

    const voice = activeVoicesRef.current[def.letter];
    if (!voice) return;
    const audioCtx = audioCtxRef.current;
    const { osc, gain } = voice;
    const now = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.stop(now + 0.09);
    delete activeVoicesRef.current[def.letter];
  }

  function findByLetter(letter) {
    return NOTE_DEFS.find((d) => d.letter === letter.toUpperCase());
  }

  // Computer keyboard support.
  useEffect(() => {
    const pressedKeys = new Set();

    function handleKeyDown(e) {
      if (e.repeat) return;
      const def = findByLetter(e.key);
      if (def && !pressedKeys.has(e.key)) {
        pressedKeys.add(e.key);
        noteOn(def);
      }
    }
    function handleKeyUp(e) {
      const def = findByLetter(e.key);
      pressedKeys.delete(e.key);
      if (def) noteOff(def);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Oscilloscope draw loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let rafId;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function draw() {
      rafId = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      if (!analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.strokeStyle = '#5fd9c4';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="unit">
      <div className="screw tl"></div>
      <div className="screw tr"></div>
      <div className="screw bl"></div>
      <div className="screw br"></div>

      <div className="plate">
        <div className="brand">
          <div className="name">UX Lab Notes</div>
          <div className="sub">8-voice · one octave · click or type</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div className="status">
            <span className="led"></span>ready
          </div>
          <div className="waveform-select">
            {WAVES.map((wave) => (
              <button
                key={wave}
                className={`wave-btn ${currentWave === wave ? 'active' : ''}`}
                onClick={() => setCurrentWave(wave)}
              >
                {WAVE_LABELS[wave]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scope-wrap">
        <canvas ref={canvasRef} id="scope"></canvas>
        <div className="scope-caption">
          <span>Ch.1 Output</span>
          <span ref={lastNoteRef}>—</span>
        </div>
      </div>

      <div className="keys" ref={keysRef}>
        {WHITE_KEYS.map((def) => (
          <div
            key={def.letter}
            ref={(el) => (keyElRefs.current[def.letter] = el)}
            className="white-key"
            onMouseDown={() => noteOn(def)}
            onMouseUp={() => noteOff(def)}
            onMouseLeave={() => noteOff(def)}
            onTouchStart={(e) => {
              e.preventDefault();
              noteOn(def);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              noteOff(def);
            }}
          >
            <span className="letter">{def.letter}</span>
            <span className="note">{def.note}</span>
          </div>
        ))}
        {BLACK_KEYS.map((def) => (
          <div
            key={def.letter}
            ref={(el) => (keyElRefs.current[def.letter] = el)}
            className="black-key"
            onMouseDown={() => noteOn(def)}
            onMouseUp={() => noteOff(def)}
            onMouseLeave={() => noteOff(def)}
            onTouchStart={(e) => {
              e.preventDefault();
              noteOn(def);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              noteOff(def);
            }}
          >
            <span className="letter">{def.letter}</span>
          </div>
        ))}
      </div>

      <div className="footer-label">
        <span>A W S E D F T G Y H U J K → C4 to E5</span>
        <span>Space: hold sustain off</span>
      </div>
    </div>
  );
}
