import { useEffect, useRef, useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";
import { TRACKS, trackDuration } from "../data/tracks";

export default function MusicPlayer({
  inputRef,
  onBack,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onBack: () => void;
  wifi: boolean;
  bt: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const startRef = useRef(0);

  const track = TRACKS[idx];
  const dur = trackDuration(track);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const t = (performance.now() - startRef.current) / 1000;
      if (t >= dur) {
        setPlaying(false);
        setElapsed(0);
      } else {
        setElapsed(t);
      }
    }, 80);
    return () => clearInterval(id);
  }, [playing, dur]);

  const play = () => {
    soundEngine.init();
    soundEngine.resume();
    soundEngine.stopAll();
    soundEngine.melody(track.notes, 0);
    startRef.current = performance.now();
    setElapsed(0);
    setPlaying(true);
  };
  const stop = () => {
    soundEngine.stopAll();
    setPlaying(false);
    setElapsed(0);
  };
  const changeTrack = (d: number) => {
    stop();
    setIdx((v) => (v + d + TRACKS.length) % TRACKS.length);
  };

  usePolledInput(
    inputRef,
    {
      onLeft: () => changeTrack(-1),
      onRight: () => changeTrack(1),
      onA: () => (playing ? stop() : play()),
      onUp: () => setVolume((v) => Math.min(1, v + 0.1)),
      onDown: () => setVolume((v) => Math.max(0, v - 0.1)),
      onB: () => {
        stop();
        onBack();
      },
    },
    [playing, idx, dur],
  );

  useEffect(() => soundEngine.setVolume(volume), [volume]);

  const caption = [...track.captions].reverse().find((c) => elapsed >= c.at)?.text ?? "";

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="MUSIC PLAYER" wifi={wifi} bt={bt} />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 font-['VT323']">
        <div className="text-[12px] opacity-60">
          TRACK {idx + 1}/{TRACKS.length}
        </div>
        <div className="text-[20px] tracking-wide">{track.title}</div>
        <div className="flex items-center gap-3 text-[20px]">
          <span onClick={() => changeTrack(-1)} className="cursor-pointer">
            ⏮
          </span>
          <span onClick={() => (playing ? stop() : play())} className="cursor-pointer text-[26px]">
            {playing ? "⏸" : "▶"}
          </span>
          <span onClick={() => changeTrack(1)} className="cursor-pointer">
            ⏭
          </span>
        </div>
        <div className="h-[6px] w-full max-w-[220px] overflow-hidden rounded-full border border-current/40">
          <div className="h-full bg-current/70" style={{ width: `${Math.min(100, (elapsed / dur) * 100)}%` }} />
        </div>
        <div className="h-[16px] text-[14px] italic opacity-90 transition-opacity duration-300">
          {playing ? `♪ ${caption}` : "PRESS A TO PLAY"}
        </div>
        <div className="text-[11px] opacity-60">VOL {Math.round(volume * 100)}% — buzzer chiptune mode</div>
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ◀▶ TRACK &nbsp; A PLAY/STOP &nbsp; ▲▼ VOL &nbsp; B BACK
      </div>
    </div>
  );
}
