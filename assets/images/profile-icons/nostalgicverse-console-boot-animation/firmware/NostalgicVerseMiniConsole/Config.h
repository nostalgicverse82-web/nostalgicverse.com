#pragma once
#include <stdint.h>

// ---------- DISPLAY ----------
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1
#define OLED_ADDR      0x3C

// ---------- BUZZER ----------
#define BUZZER_PIN            4
#define BUZZER_LEDC_CHANNEL   0
#define BUZZER_LEDC_RES       8

// ---------- KEYPAD (4x4) ----------
// ⚠ ADJUST THESE to match your actual wiring. Placeholders chosen
// to avoid the most sensitive strapping pins (0, 2, 15 avoided).
#define KEYPAD_ROW_PINS { 13, 12, 14, 27 }
#define KEYPAD_COL_PINS { 26, 25, 33, 32 }

// ---------- SYSTEM ----------
#define MAX_PARTICLES   48