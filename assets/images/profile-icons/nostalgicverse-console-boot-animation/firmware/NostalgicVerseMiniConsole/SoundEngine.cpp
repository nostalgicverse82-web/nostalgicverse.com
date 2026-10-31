#include "SoundEngine.h"
#include <Arduino.h>
#include "Config.h"

void SoundEngine::begin(uint8_t pin) {
    _pin = pin;
    ledcSetup(BUZZER_LEDC_CHANNEL, 2000, BUZZER_LEDC_RES);
    ledcAttachPin(pin, BUZZER_LEDC_CHANNEL);
    ledcWrite(BUZZER_LEDC_CHANNEL, 0);
}

void SoundEngine::playSequence(const Note* notes, uint8_t count) {
    _seq = notes;
    _count = count;
    _index = 0;
    _playing = count > 0;
    if (_playing) startNote(0, millis());
}

void SoundEngine::playSingle(uint16_t freq, uint16_t durationMs) {
    static Note single[1];
    single[0].freq = freq;
    single[0].durationMs = durationMs;
    playSequence(single, 1);
}

void SoundEngine::startNote(uint8_t idx, uint32_t now) {
    const Note &n = _seq[idx];
    ledcWriteTone(BUZZER_LEDC_CHANNEL, n.freq); // freq 0 = silence
    _noteStart = now;
    _index = idx;
}

void SoundEngine::update(uint32_t nowMs) {
    if (!_playing) return;
    const Note &n = _seq[_index];
    if (nowMs - _noteStart >= n.durationMs) {
        uint8_t next = _index + 1;
        if (next >= _count) stop();
        else startNote(next, nowMs);
    }
}

void SoundEngine::stop() {
    ledcWriteTone(BUZZER_LEDC_CHANNEL, 0);
    _playing = false;
    _seq = nullptr;
}