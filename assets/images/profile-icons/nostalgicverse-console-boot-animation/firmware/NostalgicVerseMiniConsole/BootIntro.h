#pragma once
#include <RTClib.h>
#include "DisplayManager.h"
#include "ParticleSystem.h"
#include "SoundEngine.h"
#include "RTCService.h"
#include "SystemDiagnostics.h"

// The flagship cinematic. Also the template for every future
// "moment" in the OS: achievement unlock, game launch, victory, etc.
class BootIntro {
public:
    void begin(DisplayManager* disp, SoundEngine* sound,
               RTCService* rtc, SystemDiagnostics* diag);
    void restart();
    void tick(uint32_t nowMs);
    void skip();
    bool isFinished() const { return _finished; }

private:
    DisplayManager* _disp = nullptr;
    SoundEngine* _sound = nullptr;
    RTCService* _rtc = nullptr;
    SystemDiagnostics* _diag = nullptr;
    ParticleSystem _particles;
    DateTime _cachedTime;

    uint32_t _startMs = 0;
    uint32_t _lastTickMs = 0;
    bool _finished = false;

    static const uint8_t MAX_CUES = 64;
    bool _fired[MAX_CUES];
    bool fire(uint8_t id);

    // Phases (continuous timeline — see .cpp for exact ms ranges)
    void phaseVoid(uint32_t t);
    void phaseSignal(uint32_t t);
    void phaseCore(uint32_t t);
    void phaseSystemBoot(uint32_t t);
    void phaseRTC(uint32_t t);
    void phaseGameUniverse(uint32_t t);
    void phaseMusicUtil(uint32_t t);
    void phaseConnectivity(uint32_t t);
    void phaseDataSystem(uint32_t t);
    void phaseRaceImpact(uint32_t t);
    void phaseLogoExplosion(uint32_t t);
    void phaseFinalIdentity(uint32_t t);

    // Pixel-art helpers (swap for real sprite bitmaps later)
    void drawHero(int16_t x, int16_t y);
    void drawCar(int16_t x, int16_t y, bool boosting);
    void drawShip(int16_t x, int16_t y);
    void drawBlocksGrid(int16_t x, int16_t y, uint8_t variant);
    void drawCartridge(int16_t x, int16_t y);
    void drawNote(int16_t x, int16_t y);
    void drawTrophy(int16_t x, int16_t y);
    void drawGraphBars(int16_t x, int16_t y, uint32_t t, uint32_t startT, uint32_t dur);
    void drawKeypadIcon(int16_t x, int16_t y);
    void drawPhoneIcon(int16_t x, int16_t y);
    void drawControllerIcon(int16_t x, int16_t y);
    void drawWifiWaves(int16_t cx, int16_t cy, uint32_t t, uint32_t startT);
    void drawBTIcon(int16_t x, int16_t y);
    void drawSaveIcon(int16_t x, int16_t y);
    void drawAvatar(int16_t x, int16_t y);
    void drawGear(int16_t cx, int16_t cy, uint32_t t);

    void buildLogoTargets();
    void drawCenteredText(const char* txt, int16_t y, uint8_t size = 1);
};