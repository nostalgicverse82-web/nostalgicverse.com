#include "DisplayManager.h"

bool DisplayManager::begin() {
    if (!_oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        return false;
    }
    _oled.clearDisplay();
    _oled.display();
    _oled.setTextColor(SSD1306_WHITE);
    _oled.cp437(true);
    return true;
}

void DisplayManager::clear()   { _oled.clearDisplay(); }
void DisplayManager::present() { _oled.display(); }