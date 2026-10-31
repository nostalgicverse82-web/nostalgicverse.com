#include <Wire.h>
#include <WiFi.h>
#include <BluetoothSerial.h>

#include "Config.h"
#include "SystemState.h"
#include "SystemDiagnostics.h"
#include "DisplayManager.h"
#include "SoundEngine.h"
#include "RTCService.h"
#include "BootIntro.h"

#if !defined(CONFIG_BT_ENABLED)
#error Bluetooth is not enabled — check Tools > Partition Scheme / Board config
#endif

DisplayManager      display;
SoundEngine         sound;
RTCService          rtcService;
BootIntro           bootIntro;
SystemDiagnostics   diagnostics;
BluetoothSerial     btSerial;

SystemState systemState = BOOT_INTRO;

const uint8_t KEY_ROWS[4] = KEYPAD_ROW_PINS;
const uint8_t KEY_COLS[4] = KEYPAD_COL_PINS;

bool anyKeyPressed() {
    for (uint8_t c = 0; c < 4; c++) {
        pinMode(KEY_COLS[c], OUTPUT);
        digitalWrite(KEY_COLS[c], LOW);
    }
    bool pressed = false;
    for (uint8_t r = 0; r < 4; r++) {
        pinMode(KEY_ROWS[r], INPUT_PULLUP);
        if (digitalRead(KEY_ROWS[r]) == LOW) pressed = true;
    }
    for (uint8_t c = 0; c < 4; c++) pinMode(KEY_COLS[c], INPUT);
    return pressed;
}

void initHardware() {
    Wire.begin();

    diagnostics.displayOK = display.begin();
    diagnostics.rtcOK     = rtcService.begin();

    sound.begin(BUZZER_PIN);
    diagnostics.audioOK = true; // pin configured — no readback possible for a passive buzzer

    for (uint8_t c = 0; c < 4; c++) pinMode(KEY_COLS[c], INPUT);
    for (uint8_t r = 0; r < 4; r++) pinMode(KEY_ROWS[r], INPUT_PULLUP);
    diagnostics.inputOK = true;

    WiFi.mode(WIFI_AP);
    diagnostics.wifiOK = WiFi.softAP("NostalgicVerse-Console", "nostalgic1234");

    diagnostics.btOK = btSerial.begin("NostalgicVerse");

    diagnostics.storageOK = false; // no SD module wired yet
}

void setup() {
    randomSeed(analogRead(34));
    initHardware();
    bootIntro.begin(&display, &sound, &rtcService, &diagnostics);
}

void loop() {
    uint32_t now = millis();

    switch (systemState) {
        case BOOT_INTRO:
            bootIntro.tick(now);
            if (anyKeyPressed()) bootIntro.skip();
            if (bootIntro.isFinished()) systemState = MAIN_MENU;
            break;

        case MAIN_MENU:
            display.clear();
            display.raw().setTextSize(1);
            display.raw().setCursor(4, 28);
            display.raw().print("MAIN MENU - TODO");
            display.present();
            break;

        default:
            break;
    }
}