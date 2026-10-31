# NostalgicVerse Mini Console — Firmware Reference

This folder is a **real Arduino IDE sketch skeleton** implementing the boot
identity system described for the NostalgicVerse Mini Console. It's the
hardware-side counterpart to the web simulator in this project (`src/console`),
built with the exact same timeline, the exact same sound design philosophy,
and the exact same "unified input" architecture — just in C++ for the ESP32.

> This is a structural reference/starting point, not a drop-in finished
> product. You'll still need to wire up your specific panel/menu rendering
> for each `SystemState`, following the patterns already laid out.

## Opening the project

1. Install the **ESP32 board package** in Arduino IDE (Boards Manager →
   search "esp32" → install by Espressif Systems).
2. Install libraries via Library Manager:
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
   - `RTClib` (by Adafruit)
   - `Keypad` (by Mark Stanley / Alexander Brevig)
   - Optional: `ESPAsyncWebServer` + `AsyncTCP` (mobile WiFi controller)
   - Optional: `NimBLE-Arduino` (Bluetooth controller support)
3. Open `NostalgicVerseMiniConsole/NostalgicVerseMiniConsole.ino`.
4. Select **Board → ESP32 Dev Module** (or "NodeMCU-32S" if listed) and the
   correct COM port.
5. Build & upload.

## Wiring (defaults — see `Config.h`)

| Peripheral        | Pin(s)                         |
| ------------------ | ------------------------------ |
| OLED SDA           | GPIO 21                        |
| OLED SCL           | GPIO 22                        |
| DS1307 RTC         | shares the same I2C bus        |
| Buzzer             | GPIO 25                        |
| Keypad rows        | GPIO 13, 12, 14, 27             |
| Keypad columns     | GPIO 26, 33, 32, 15             |

Adjust `Config.h` to match your actual wiring.

## Architecture

```
NostalgicVerseMiniConsole.ino   setup()/loop(), owns `systemState`
Config.h                        pins & feature flags
SystemState.h                   SystemState enum + InputFrame struct
InputManager.*                  keypad + WiFi + BLE -> one InputFrame
RTCService.*                    DS1307 wrapper, honest availability flag
SoundEngine.*                   non-blocking buzzer "chiptune" scheduler
ParticleSystem.h                fixed-size particle pool (no heap allocation)
BootIntro.*                     the ~15s cinematic boot timeline
```

Every subsystem is designed to be:

- **Non-blocking** — no `delay()`, everything keyed off `millis()`.
- **Honest** — hardware status flags (`HardwareStatus`) reflect real
  `begin()`/`init()` results, never hard-coded "OK".
- **Input-source agnostic** — keypad, WiFi mobile controller, and Bluetooth
  gamepad all merge into the same `InputFrame`; no game or menu should ever
  branch on which one was used.

## Extending the boot timeline

`BootIntro.cpp` mirrors `src/console/engine/bootTimeline.ts` and
`src/console/screens/BootIntro.tsx` from the web prototype phase-for-phase
(VOID → SIGNAL → CORE → DIAG → RTC → UNIVERSE → CONNECT → RACE → LOGO →
FINAL). If you want to add more micro-scenes (puzzle shuffle, music/
utilities flash cards, save/profile/achievement montage, etc.) just add
another `phaseXxx()` method and a timing constant in the
`NVBootTimeline` namespace — the pattern is always:

```cpp
void BootIntro::phaseExample(uint32_t l) {
  // l = milliseconds since this phase started
  // draw directly with gfx_->... calls, no delay()
}
```

## Reusing the boot "identity"

`SoundEngine::playSignature()` plays the 3-note NostalgicVerse motif used at
the end of the boot animation. Call it again from game-over / victory /
achievement-unlock / controller-connect code so the whole console shares one
consistent sonic identity, exactly as described in the design brief.
