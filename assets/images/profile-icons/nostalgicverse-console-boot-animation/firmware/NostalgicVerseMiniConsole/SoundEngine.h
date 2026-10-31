#pragma once
#include <stdint.h>

struct Note {
    uint16_t freq;        // 0 = rest
    uint16_t durationMs;
};

// Non-blocking note sequencer built on ESP32 LEDC.
// No delay() anywhere. update() must be called every loop.
class SoundEngine {
public:
    void begin(uint8_t pin);
    void playSequence(const Note* notes, uint8_t count);
    void playSingle(uint16_t freq, uint16_t durationMs);
    void update(uint32_t nowMs);
    void stop();
    bool isPlaying() const { return _playing; }

private:
    uint8_t _pin = 0;
    const Note* _seq = nullptr;
    uint8_t _count = 0;
    uint8_t _index = 0;
    uint32_t _noteStart = 0;
    bool _playing = false;

    void startNote(uint8_t idx, uint32_t now);
};