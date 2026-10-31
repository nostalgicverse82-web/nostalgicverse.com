#pragma once
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "Config.h"

// Thin wrapper so BootIntro / future game code never touches
// Adafruit_SSD1306 directly. Later, add TFTRenderer with the
// same interface and swap it in without touching animation code.
class DisplayManager {
public:
    bool begin();
    void clear();
    void present();
    Adafruit_SSD1306& raw() { return _oled; }
    int16_t width()  const { return SCREEN_WIDTH; }
    int16_t height() const { return SCREEN_HEIGHT; }

private:
    Adafruit_SSD1306 _oled{SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET};
};