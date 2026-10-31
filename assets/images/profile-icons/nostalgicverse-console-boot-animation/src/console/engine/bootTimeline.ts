// Single source of truth for the boot intro timing (milliseconds).
// Visuals (BootIntro.tsx) and audio (bootAudio.ts) both key off this table
// so the "one continuous shot" always stays in sync.
export const T = {
  VOID0: 0,
  VOID_END: 850,
  SIGNAL0: 850,
  SIGNAL_END: 1750,
  CORE0: 1750,
  CORE_END: 2950,
  DIAG0: 2950,
  DIAG_END: 4250,
  RTC0: 4250,
  RTC_END: 5550,
  UNIVERSE0: 5550,
  UNIVERSE_END: 7850,
  MUSIC0: 7850,
  MUSIC_END: 8850,
  CONNECT0: 8850,
  CONNECT_END: 10100,
  DATA0: 10100,
  DATA_END: 11300,
  RACE0: 11300,
  RACE_END: 12950,
  LOGO0: 12950,
  LOGO_END: 13550,
  FINAL0: 13550,
} as const;
