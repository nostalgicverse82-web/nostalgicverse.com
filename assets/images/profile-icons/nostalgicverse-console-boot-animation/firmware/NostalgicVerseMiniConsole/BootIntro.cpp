#include "BootIntro.h"
#include <Arduino.h>
#include <math.h>
#include "Config.h"

// ---------------------------------------------------------------
// ORIGINAL SOUND LIBRARY — no copyrighted material.
// Last 3 notes of SND_SIGNATURE / SND_SIGNATURE_SHORT are the
// reusable NostalgicVerse signature (achievement, launch, victory...)
// ---------------------------------------------------------------
static const Note SND_SWEEP[]   = {{300,20},{400,20},{520,20},{650,20},
                                    {800,20},{1000,20},{1250,20},{1550,20}};
static const Note SND_READY[]   = {{700,40},{1050,60}};
static const Note SND_DING[]    = {{1760,60},{2093,80}};
static const Note SND_COUNT[]   = {{700,90}};
static const Note SND_GO[]      = {{1200,40},{1600,40},{2000,120}};
static const Note SND_SIGNATURE_SHORT[] = {{784,100},{1047,100},{1319,260}};

bool BootIntro::fire(uint8_t id) {
    if (id >= MAX_CUES) return false;
    if (_fired[id]) return false;
    _fired[id] = true;
    return true;
}

void BootIntro::begin(DisplayManager* disp, SoundEngine* sound,
                       RTCService* rtc, SystemDiagnostics* diag) {
    _disp = disp; _sound = sound; _rtc = rtc; _diag = diag;
    restart();
}

void BootIntro::restart() {
    _startMs = millis();
    _lastTickMs = _startMs;
    _finished = false;
    memset(_fired, 0, sizeof(_fired));
    _particles.clearAll();
}

void BootIntro::skip() {
    _sound->stop();
    _finished = true;
}

// ---------------------------------------------------------------
// MAIN TIMELINE — one continuous 15s shot, no hard screen cuts.
// ---------------------------------------------------------------
void BootIntro::tick(uint32_t nowMs) {
    if (_finished) return;

    uint32_t t = nowMs - _startMs;
    uint16_t dt = (uint16_t)(nowMs - _lastTickMs);
    if (dt > 50) dt = 50; // clamp — protects against any stall
    _lastTickMs = nowMs;

    _particles.update(dt);
    _sound->update(nowMs);
    _disp->clear();

    if      (t < 400)   phaseVoid(t);
    else if (t < 900)   phaseSignal(t);
    else if (t < 1600)  phaseCore(t);
    else if (t < 2400)  phaseSystemBoot(t);
    else if (t < 3200)  phaseRTC(t);
    else if (t < 5200)  phaseGameUniverse(t);
    else if (t < 6000)  phaseMusicUtil(t);
    else if (t < 7200)  phaseConnectivity(t);
    else if (t < 8200)  phaseDataSystem(t);
    else if (t < 9800)  phaseRaceImpact(t);
    else if (t < 10600) phaseLogoExplosion(t);
    else if (t < 15000) phaseFinalIdentity(t);
    else { _finished = true; }

    _particles.draw(*_disp);
    _disp->present();
}

// ---------------------------------------------------------------
// 0 – 400ms  THE VOID → first signal of life
// ---------------------------------------------------------------
void BootIntro::phaseVoid(uint32_t t) {
    auto &oled = _disp->raw();
    if (t >= 150 && fire(0)) _sound->playSingle(1800, 15);
    if (t >= 150 && t < 260) oled.drawPixel(64, 32, SSD1306_WHITE);
    if (t >= 260 && fire(1)) _sound->playSingle(1500, 15);
    if (t >= 260 && t < 340) oled.drawPixel(70, 28, SSD1306_WHITE);
    if (t >= 340) {
        oled.drawPixel(50, 40, SSD1306_WHITE);
        oled.drawPixel(80, 36, SSD1306_WHITE);
        oled.drawPixel(60, 20, SSD1306_WHITE);
    }
}

// 400 – 900ms  SIGNAL LINE → SNAP
void BootIntro::phaseSignal(uint32_t t) {
    auto &oled = _disp->raw();
    if (fire(3)) _sound->playSequence(SND_SWEEP, sizeof(SND_SWEEP)/sizeof(Note));
    uint32_t local = t - 400;
    int16_t len = (int16_t)((local / 450.0f) * SCREEN_WIDTH);
    if (len > SCREEN_WIDTH) len = SCREEN_WIDTH;
    oled.drawFastHLine((SCREEN_WIDTH - len) / 2, 32, len, SSD1306_WHITE);
    if (local >= 440 && fire(4)) {
        _particles.spawnBurst(64, 32, MAX_PARTICLES / 3, 20, 60, 300);
        _sound->playSingle(80, 90);
    }
}

// 900 – 1600ms  CORE AWAKENING
void BootIntro::phaseCore(uint32_t t) {
    auto &oled = _disp->raw();
    if (t >= 1000 && fire(5)) _sound->playSingle(600, 30);
    if (t >= 1150 && fire(6)) _sound->playSingle(800, 30);
    if (t >= 1300 && fire(7)) _sound->playSingle(1100, 40);

    int r = 3;
    if      (t >= 1300) r = 10;
    else if (t >= 1150) r = 7;
    else if (t >= 1000) r = 4;
    oled.fillCircle(64, 32, r, SSD1306_WHITE);

    if (t >= 1400) {
        if (fire(8)) _sound->playSingle(1400, 60);
        int wr = (int)((t - 1400) / 200.0f * 10);
        if (wr < 70) oled.drawCircle(64, 32, wr, SSD1306_WHITE);
    }
}

// 1600 – 2400ms  SYSTEM BOOT — real diagnostics, one item at a time
void BootIntro::phaseSystemBoot(uint32_t t) {
    const char* names[8] = {"CORE","DISP","INPUT","AUDIO","RTC","WIFI","BT","SAVE"};
    bool oks[8] = { true, _diag->displayOK, _diag->inputOK, _diag->audioOK,
                    _diag->rtcOK, _diag->wifiOK, _diag->btOK, _diag->storageOK };

    uint8_t active = 0;
    for (uint8_t i = 0; i < 8; i++) {
        uint32_t itemStart = 1600 + i * 100;
        if (t >= itemStart) active = i;
        if (t >= itemStart && fire(10 + i)) _sound->playSingle(1500, 12);
    }

    uint32_t itemStart = 1600 + active * 100;
    float p = (t - itemStart) / 100.0f;
    if (p > 1) p = 1;
    float fillP = oks[active] ? p : p * 0.3f;

    auto &oled = _disp->raw();
    drawCenteredText(names[active], 20);
    oled.drawRect(14, 30, 100, 6, SSD1306_WHITE);
    oled.fillRect(14, 30, (int16_t)(100 * fillP), 6, SSD1306_WHITE);
    if (!oks[active]) drawCenteredText("!", 40);

    if (t >= 2350 && fire(18)) _sound->playSequence(SND_READY, 2);
    if (t >= 2350) {
        drawCenteredText("SYSTEM", 46);
        drawCenteredText("READY", 54);
    }
}

// 2400 – 3200ms  RTC MOMENT — real time, never faked
void BootIntro::phaseRTC(uint32_t t) {
    drawCenteredText("RTC", 16);
    if (t >= 2400 && fire(19)) _sound->playSingle(2000, 10);
    drawCenteredText("SYNC", 26);

    if (!_diag->rtcOK) {
        if (t >= 2600) drawCenteredText("RTC !", 40);
        return;
    }
    if (t >= 2500 && fire(20)) _cachedTime = _rtc->now();

    if (t >= 2700) {
        char buf[12];
        snprintf(buf, sizeof(buf), "%02d:%02d:%02d",
                 _cachedTime.hour(), _cachedTime.minute(), _cachedTime.second());
        drawCenteredText(buf, 40);
    }
    if (t >= 3050 && fire(21)) _sound->playSingle(2000, 10);
    if (t >= 3050) {
        char buf[14];
        snprintf(buf, sizeof(buf), "%04d-%02d-%02d",
                 _cachedTime.year(), _cachedTime.month(), _cachedTime.day());
        drawCenteredText(buf, 50);
    }
}

// 3200 – 5200ms  THE GAMING UNIVERSE — 5 rapid micro-scenes
void BootIntro::phaseGameUniverse(uint32_t t) {
    auto &oled = _disp->raw();
    if (t < 3600) {
        float p = (t - 3200) / 400.0f;
        oled.drawFastHLine(0, 50, SCREEN_WIDTH, SSD1306_WHITE);
        int16_t hx = 10 + (int16_t)(p * 90);
        int16_t hy = 44 - (int16_t)(sinf(p * PI) * 14);
        drawHero(hx, hy);
        oled.fillRect(60, 46, 6, 4, SSD1306_WHITE);
        oled.drawCircle(90, 40, 2, SSD1306_WHITE);
        if (p > 0.75f && fire(24)) {
            _sound->playSequence(SND_DING, 2);
            _particles.spawnBurst(90, 40, 6, 10, 30, 250);
        }
    } else if (t < 4000) {
        if (fire(25)) _sound->playSingle(500, 30);
        float p = (t - 3600) / 400.0f;
        oled.drawFastHLine(0, 50, SCREEN_WIDTH, SSD1306_WHITE);
        drawCar((int16_t)(p * 140) - 10, 42, true);
        for (int i = 0; i < 4; i++)
            oled.drawFastHLine(0, 10 + i*4, (int16_t)(p * (SCREEN_WIDTH - i*10)), SSD1306_WHITE);
    } else if (t < 4400) {
        if (fire(26)) _sound->playSingle(300, 30);
        float p = (t - 4000) / 400.0f;
        drawShip(6, 28);
        int16_t px = 16 + (int16_t)(p * 80);
        oled.drawFastHLine(16, 30, px - 16, SSD1306_WHITE);
        if (p > 0.7f && fire(27)) {
            _particles.spawnBurst(px, 30, 8, 15, 40, 220);
            _sound->playSingle(90, 70);
        }
    } else if (t < 4800) {
        uint8_t variant = ((t - 4400) / 100) % 2;
        drawBlocksGrid(55, 24, variant);
    } else {
        if (fire(29)) _sound->playSingle(1400, 25);
        drawCartridge(55, 26);
        drawCenteredText("CORE", 44);
        drawCenteredText("READY", 52);
    }
}

// 5200 – 6000ms  MUSIC + UTILITIES
void BootIntro::phaseMusicUtil(uint32_t t) {
    if (t < 5450) {
        drawNote(60, 24);
        for (int i = 0; i < 5; i++) {
            int h = 2 + ((t + i*37) % 10);
            _disp->raw().fillRect(70 + i*4, 30 - h, 2, h, SSD1306_WHITE);
        }
        drawCenteredText("MUSIC PLAYER", 50);
    } else if (t < 5650) {
        const char* labels[3] = {"CLOCK", "TIMER", "CALC"};
        drawCenteredText(labels[((t - 5450) / 70) % 3], 30);
    } else if (t < 5850) {
        if (fire(32)) _sound->playSingle(1200, 40);
        drawTrophy(58, 20);
        drawCenteredText("ACHIEVEMENT", 46);
    } else {
        drawGraphBars(50, 36, t, 5850, 150);
        drawCenteredText("STATS", 50);
    }
}

// 6000 – 7200ms  CONNECTIVITY — keypad + mobile + BT → unified input
void BootIntro::phaseConnectivity(uint32_t t) {
    auto &oled = _disp->raw();
    if (t < 6350) {
        drawKeypadIcon(10, 14);
        drawPhoneIcon(10, 30);
        drawControllerIcon(8, 46);
        oled.drawLine(20, 16, 64, 32, SSD1306_WHITE);
        oled.drawLine(16, 34, 64, 32, SSD1306_WHITE);
        oled.drawLine(20, 49, 64, 32, SSD1306_WHITE);
        oled.fillCircle(64, 32, 2, SSD1306_WHITE);
        if (t > 6300 && fire(35)) _sound->playSequence(SND_READY, 2);
        drawCenteredText("INPUT READY", 56);
    } else if (t < 6800) {
        drawWifiWaves(64, 30, t, 6500);
        drawCenteredText(_diag->wifiOK ? "WIFI READY" : "WIFI OFF", 50);
    } else {
        drawBTIcon(60, 18);
        drawCenteredText(_diag->btOK ? "BT READY" : "BT OFF", 50);
    }
}

// 7200 – 8200ms  SAVE / PROFILE / ACHIEVEMENTS / STATS / SYSTEM
void BootIntro::phaseDataSystem(uint32_t t) {
    if (t < 7450) {
        if (fire(38)) { _particles.spawnBurst(64,32,6,10,30,200); _sound->playSingle(800,30); }
        drawSaveIcon(58, 24);
        drawCenteredText("SAVE DATA", 50);
    } else if (t < 7650) {
        drawAvatar(64, 26);
        drawCenteredText("PROFILE", 50);
    } else if (t < 7850) {
        drawTrophy(58, 20);
        drawCenteredText("ACHIEVEMENTS", 50);
    } else if (t < 8050) {
        drawGraphBars(50, 36, t, 7850, 150);
        drawCenteredText("STATISTICS", 50);
    } else {
        drawGear(64, 28, t);
        drawCenteredText("SYSTEM", 50);
        if (t > 8150 && fire(43)) _particles.spawnBurst(64, 28, 10, 20, 50, 300);
    }
}

// 8200 – 9800ms  FQ RACING IMPACT
void BootIntro::phaseRaceImpact(uint32_t t) {
    auto &oled = _disp->raw();
    if (t < 8300) {
        for (int i = 0; i < 5; i++) oled.drawLine(64, 32, i*32, 64, SSD1306_WHITE);
        drawCar(56, 50, false);
    } else if (t < 8600) {
        if (fire(45)) _sound->playSequence(SND_COUNT, 1);
        drawCenteredText("3", 24, 2);
    } else if (t < 8900) {
        if (fire(46)) _sound->playSequence(SND_COUNT, 1);
        drawCenteredText("2", 24, 2);
    } else if (t < 9200) {
        if (fire(47)) _sound->playSequence(SND_COUNT, 1);
        drawCenteredText("1", 24, 2);
    } else if (t < 9300) {
        if (fire(48)) _sound->playSequence(SND_GO, 3);
        drawCenteredText("GO!", 22, 2);
    } else if (t < 9600) {
        float p = (t - 9300) / 300.0f;
        drawCar((int16_t)(p * 150) - 10, 42, true);
        oled.drawFastHLine(0, 50, SCREEN_WIDTH, SSD1306_WHITE);
        uint8_t lines = (uint8_t)(p * 8);
        for (int i = 0; i < lines; i++)
            oled.drawFastHLine(0, 10 + i*5, (int16_t)(p * SCREEN_WIDTH), SSD1306_WHITE);
    } else {
        if (fire(49)) {
            _particles.spawnBurst(64, 32, MAX_PARTICLES / 2, 30, 80, 350);
            _sound->playSingle(2200, 80);
        }
    }
}

// 9800 – 10600ms  LOGO EXPLOSION — particles literally sample the glyphs
void BootIntro::buildLogoTargets() {
    // Compose the wordmark into an off-screen canvas, then read back
    // which pixels are lit. Particles are born at the edges and home
    // toward those exact coordinates — the logo is built FROM particles.
    GFXcanvas1 canvas(SCREEN_WIDTH, SCREEN_HEIGHT);
    canvas.setTextSize(1);
    canvas.setTextColor(1);
    const char* txt = "NOSTALGICVERSE";
    int16_t x1, y1; uint16_t w, h;
    canvas.getTextBounds(txt, 0, 0, &x1, &y1, &w, &h);
    canvas.setCursor((SCREEN_WIDTH - (int16_t)w) / 2, 28);
    canvas.print(txt);

    uint16_t totalLit = 0;
    for (int16_t yy = 0; yy < SCREEN_HEIGHT; yy++)
        for (int16_t xx = 0; xx < SCREEN_WIDTH; xx++)
            if (canvas.getPixel(xx, yy)) totalLit++;

    uint16_t stride = totalLit > MAX_PARTICLES ? totalLit / MAX_PARTICLES : 1;
    uint16_t counter = 0, collected = 0;
    for (int16_t yy = 0; yy < SCREEN_HEIGHT && collected < MAX_PARTICLES; yy++) {
        for (int16_t xx = 0; xx < SCREEN_WIDTH && collected < MAX_PARTICLES; xx++) {
            if (canvas.getPixel(xx, yy)) {
                if (counter % stride == 0) {
                    float sx = (float)random(0, SCREEN_WIDTH);
                    float sy = (random(0,2) == 0) ? -4.0f : (float)(SCREEN_HEIGHT + 4);
                    _particles.spawnHoming(sx, sy, (float)xx, (float)yy, 450);
                    collected++;
                }
                counter++;
            }
        }
    }
}

void BootIntro::phaseLogoExplosion(uint32_t t) {
    if (t < 9900) return; // one beat of silence before the reveal
    if (fire(50)) {
        buildLogoTargets();
        _sound->playSingle(60, 120);
    }
    if (t >= 10400) {
        drawCenteredText("NOSTALGICVERSE", 28);
        if (fire(51)) _sound->playSequence(SND_SIGNATURE_SHORT, 3);
    }
}

// 10600 – 15000ms  FINAL IDENTITY
void BootIntro::phaseFinalIdentity(uint32_t t) {
    drawCenteredText("NOSTALGICVERSE", 8);
    if (t >= 11000) drawCenteredText("MINI CONSOLE", 20);
    if (t >= 11600) {
        drawCenteredText("SYSTEM READY", 32);
        if (fire(52)) _sound->playSequence(SND_SIGNATURE_SHORT, 3);
    }
    if (t >= 12100) {
        const char* items[4] = {
            _diag->rtcOK   ? "RTC OK"   : "RTC !",
            _diag->inputOK ? "INPUT OK" : "INPUT !",
            _diag->audioOK ? "AUDIO OK" : "AUDIO !",
            _diag->wifiOK  ? "WIFI OK"  : "WIFI OFF"
        };
        drawCenteredText(items[((t - 12100) / 350) % 4], 44);
    }
    if (t >= 13000 && (t / 400) % 2 == 0) {
        drawCenteredText("PRESS START", 56);
    }
}

// ---------------------------------------------------------------
// Pixel-art helpers — deliberately simple primitives for now.
// Swap for hand-authored PROGMEM bitmaps later for final polish;
// the call sites won't need to change.
// ---------------------------------------------------------------
void BootIntro::drawCenteredText(const char* txt, int16_t y, uint8_t size) {
    auto &oled = _disp->raw();
    oled.setTextSize(size);
    int16_t x1, y1; uint16_t w, h;
    oled.getTextBounds(txt, 0, 0, &x1, &y1, &w, &h);
    oled.setCursor((SCREEN_WIDTH - (int16_t)w) / 2, y);
    oled.print(txt);
}

void BootIntro::drawHero(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.fillRect(x, y, 3, 5, SSD1306_WHITE);
    oled.drawPixel(x+1, y-1, SSD1306_WHITE);
}

void BootIntro::drawCar(int16_t x, int16_t y, bool boosting) {
    auto &oled = _disp->raw();
    oled.fillRect(x, y, 10, 4, SSD1306_WHITE);
    oled.fillRect(x+2, y-2, 5, 2, SSD1306_WHITE);
    oled.drawPixel(x+1, y+4, SSD1306_WHITE);
    oled.drawPixel(x+8, y+4, SSD1306_WHITE);
    if (boosting) {
        oled.drawLine(x-2, y+1, x-6, y, SSD1306_WHITE);
        oled.drawLine(x-2, y+3, x-6, y+4, SSD1306_WHITE);
    }
}

void BootIntro::drawShip(int16_t x, int16_t y) {
    _disp->raw().fillTriangle(x, y, x, y+6, x+8, y+3, SSD1306_WHITE);
}

void BootIntro::drawBlocksGrid(int16_t x, int16_t y, uint8_t variant) {
    auto &oled = _disp->raw();
    int positions[4][2] = {{0,0},{5,0},{0,5},{5,5}};
    for (int i = 0; i < 4; i++) {
        int idx = variant ? (3 - i) : i;
        oled.fillRect(x+positions[idx][0], y+positions[idx][1], 4, 4, SSD1306_WHITE);
    }
}

void BootIntro::drawCartridge(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.drawRect(x, y, 14, 10, SSD1306_WHITE);
    oled.fillRect(x+4, y-2, 6, 2, SSD1306_WHITE);
}

void BootIntro::drawNote(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.fillCircle(x, y+6, 2, SSD1306_WHITE);
    oled.drawLine(x+2, y+6, x+2, y, SSD1306_WHITE);
    oled.drawLine(x+2, y, x+6, y+1, SSD1306_WHITE);
}

void BootIntro::drawTrophy(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.fillRect(x+2, y+6, 4, 4, SSD1306_WHITE);
    oled.drawCircle(x+4, y+3, 4, SSD1306_WHITE);
}

void BootIntro::drawGraphBars(int16_t x, int16_t y, uint32_t t, uint32_t startT, uint32_t dur) {
    float p = (float)(t - startT) / dur;
    if (p < 0) p = 0; if (p > 1) p = 1;
    int heights[4] = {4, 8, 6, 10};
    for (int i = 0; i < 4; i++) {
        int h = (int)(heights[i] * p);
        _disp->raw().fillRect(x + i*6, y + 10 - h, 4, h, SSD1306_WHITE);
    }
}

void BootIntro::drawKeypadIcon(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    for (int r = 0; r < 2; r++)
        for (int c = 0; c < 2; c++)
            oled.fillRect(x + c*4, y + r*4, 2, 2, SSD1306_WHITE);
}

void BootIntro::drawPhoneIcon(int16_t x, int16_t y) {
    _disp->raw().drawRoundRect(x, y, 6, 10, 2, SSD1306_WHITE);
}

void BootIntro::drawControllerIcon(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.drawRoundRect(x, y, 12, 6, 2, SSD1306_WHITE);
    oled.drawPixel(x+3, y+3, SSD1306_WHITE);
    oled.drawPixel(x+9, y+3, SSD1306_WHITE);
}

void BootIntro::drawWifiWaves(int16_t cx, int16_t cy, uint32_t t, uint32_t startT) {
    uint32_t local = t - startT;
    for (int i = 0; i < 3; i++) {
        int r = 4 + i*6 + (local/40)%6;
        _disp->raw().drawCircle(cx, cy, r, SSD1306_WHITE);
    }
}

void BootIntro::drawBTIcon(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.drawLine(x, y, x+4, y+8, SSD1306_WHITE);
    oled.drawLine(x+4, y+8, x, y+16, SSD1306_WHITE);
    oled.drawLine(x, y, x+4, y+4, SSD1306_WHITE);
}

void BootIntro::drawSaveIcon(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.drawRect(x, y, 10, 8, SSD1306_WHITE);
    oled.fillRect(x+2, y, 4, 3, SSD1306_WHITE);
}

void BootIntro::drawAvatar(int16_t x, int16_t y) {
    auto &oled = _disp->raw();
    oled.fillCircle(x, y, 3, SSD1306_WHITE);
    oled.fillTriangle(x-4,y+10, x+4,y+10, x,y+3, SSD1306_WHITE);
}

void BootIntro::drawGear(int16_t cx, int16_t cy, uint32_t t) {
    auto &oled = _disp->raw();
    oled.drawCircle(cx, cy, 6, SSD1306_WHITE);
    float ang = (t % 1000) / 1000.0f * 2 * PI;
    for (int i = 0; i < 6; i++) {
        float a = ang + i * (2*PI/6);
        oled.drawPixel(cx + (int)(cosf(a)*8), cy + (int)(sinf(a)*8), SSD1306_WHITE);
    }
}