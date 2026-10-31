import type { Note } from "../audio/soundEngine";

export interface Track {
  title: string;
  notes: Note[];
  captions: { at: number; text: string }[]; // `at` in seconds from track start
}

// Original NostalgicVerse chiptune sketches — no copyrighted material.
export const TRACKS: Track[] = [
  {
    title: "STATIC BLOOM",
    notes: [
      { freq: 440, dur: 0.18, type: "square" },
      { freq: 523.25, dur: 0.18, type: "square" },
      { freq: 587.33, dur: 0.18, type: "square" },
      { freq: 659.25, dur: 0.3, type: "square" },
      { freq: 587.33, dur: 0.18, type: "square" },
      { freq: 523.25, dur: 0.18, type: "square" },
      { freq: 440, dur: 0.34, type: "triangle" },
    ],
    captions: [
      { at: 0, text: "SIGNAL FOUND IN THE STATIC" },
      { at: 1.1, text: "PIXELS AWAKEN" },
      { at: 2.1, text: "A NEW WORLD LOADS" },
    ],
  },
  {
    title: "CHROME HORIZON",
    notes: [
      { freq: 330, dur: 0.14, type: "sawtooth" },
      { freq: 392, dur: 0.14, type: "sawtooth" },
      { freq: 440, dur: 0.14, type: "sawtooth" },
      { freq: 523.25, dur: 0.22, type: "sawtooth" },
      { freq: 440, dur: 0.14, type: "sawtooth" },
      { freq: 523.25, dur: 0.14, type: "sawtooth" },
      { freq: 659.25, dur: 0.36, type: "sawtooth" },
    ],
    captions: [
      { at: 0, text: "BEYOND THE CHROME HORIZON" },
      { at: 0.9, text: "ENGINES HUM TO LIFE" },
      { at: 1.9, text: "RACE THE SUNSET" },
    ],
  },
  {
    title: "RETRO ORBIT",
    notes: [
      { freq: 587.33, dur: 0.2, type: "triangle" },
      { freq: 698.46, dur: 0.2, type: "triangle" },
      { freq: 880, dur: 0.26, type: "triangle" },
      { freq: 698.46, dur: 0.2, type: "triangle" },
      { freq: 587.33, dur: 0.2, type: "triangle" },
      { freq: 493.88, dur: 0.3, type: "triangle" },
      { freq: 587.33, dur: 0.4, type: "triangle" },
    ],
    captions: [
      { at: 0, text: "FLOATING THROUGH RETRO ORBIT" },
      { at: 1.2, text: "STARS REMEMBER OUR NAME" },
      { at: 2.2, text: "EVERY GENERATION. ONE UNIVERSE." },
    ],
  },
];

export function trackDuration(t: Track) {
  return t.notes.reduce((sum, n) => sum + n.dur + (n.gap ?? 0.02), 0);
}
