#pragma once
#include <Arduino.h>
#include <Keypad.h>
#include "Config.h"
#include "SystemState.h"

// ============================================================================
// InputManager — unifies three physical input sources into one InputFrame:
//   1) the 4x4 membrane keypad (always available)
//   2) a local WiFi "mobile controller" web page (POSTs button states)
//   3) a paired Bluetooth gamepad (e.g. Cosmic Byte Lumora, via BLE HID)
//
// Games and menus never touch the keypad/BLE/WiFi APIs directly — they only
// ever read the InputFrame this class produces, exactly as described in the
// architecture notes ("the games should not care which controller is used").
// ============================================================================

class InputManager {
 public:
  void begin() {
    byte rowPins[4] = NV_KEYPAD_ROW_PINS;
    byte colPins[4] = NV_KEYPAD_COL_PINS;
    static const char keys[4][4] = {
        {'1', '2', '3', 'A'},
        {'4', '5', '6', 'B'},
        {'7', '8', '9', 'C'},
        {'*', '0', '#', 'D'},
    };
    keypad_ = new Keypad(makeKeymap(keys), rowPins, colPins, 4, 4);
  }

  // Call once per loop(). Merges keypad state with whatever the WiFi/BLE
  // layers have most recently reported via setMobileState()/setBleState().
  void update() {
    InputFrame prev = frame_;
    InputFrame next;

    // --- physical keypad -> directions, following the classic 2/4/6/8
    // feature-phone convention (also reused later for calculator digits) ---
    if (keypad_) {
      keypad_->getKeys();
      for (uint8_t i = 0; i < LIST_MAX; i++) {
        if (!keypad_->key[i].stateChanged && keypad_->key[i].kstate != PRESSED &&
            keypad_->key[i].kstate != HOLD)
          continue;
        char k = keypad_->key[i].kchar;
        bool down = (keypad_->key[i].kstate == PRESSED || keypad_->key[i].kstate == HOLD);
        applyKey(k, down, next);
      }
    }
    // keep keys held across frames (Keypad lib only reports state changes
    // for some states depending on config, so OR with sticky key states)
    mergeSticky(next);

    // --- mobile (WiFi) controller overlay ---
    next.up |= mobile_.up;
    next.down |= mobile_.down;
    next.left |= mobile_.left;
    next.right |= mobile_.right;
    next.a |= mobile_.a;
    next.b |= mobile_.b;
    next.start |= mobile_.start;
    next.select |= mobile_.select;

    // --- Bluetooth gamepad overlay ---
    next.up |= ble_.up;
    next.down |= ble_.down;
    next.left |= ble_.left;
    next.right |= ble_.right;
    next.a |= ble_.a;
    next.b |= ble_.b;
    next.start |= ble_.start;
    next.select |= ble_.select;

    next.justUp = next.up && !prev.up;
    next.justDown = next.down && !prev.down;
    next.justLeft = next.left && !prev.left;
    next.justRight = next.right && !prev.right;
    next.justA = next.a && !prev.a;
    next.justB = next.b && !prev.b;
    next.justStart = next.start && !prev.start;
    next.justSelect = next.select && !prev.select;

    frame_ = next;
  }

  const InputFrame &frame() const { return frame_; }

  // Called by the WiFi mobile-controller HTTP/WebSocket handler.
  void setMobileState(const InputFrame &f) { mobile_ = f; }
  // Called by the BLE HID gamepad callback.
  void setBleState(const InputFrame &f) { ble_ = f; }

 private:
  void applyKey(char k, bool down, InputFrame &f) {
    switch (k) {
      case '2': f.up = down; break;
      case '8': f.down = down; break;
      case '4': f.left = down; break;
      case '6': f.right = down; break;
      case '5': f.a = down; break;
      case '0': f.b = down; break;
      case '#':
      case 'A': f.start = down; break;
      case '*':
      case 'B': f.select = down; break;
      default: break; // 1,3,7,9,C,D reserved for future numeric entry
    }
    if (down) sticky_[(uint8_t)k] = true;
    else sticky_[(uint8_t)k] = false;
  }

  void mergeSticky(InputFrame &f) {
    f.up |= sticky_[(uint8_t)'2'];
    f.down |= sticky_[(uint8_t)'8'];
    f.left |= sticky_[(uint8_t)'4'];
    f.right |= sticky_[(uint8_t)'6'];
    f.a |= sticky_[(uint8_t)'5'];
    f.b |= sticky_[(uint8_t)'0'];
    f.start |= sticky_[(uint8_t)'#'] || sticky_[(uint8_t)'A'];
    f.select |= sticky_[(uint8_t)'*'] || sticky_[(uint8_t)'B'];
  }

  Keypad *keypad_ = nullptr;
  InputFrame frame_;
  InputFrame mobile_;
  InputFrame ble_;
  bool sticky_[128] = {false};
};

extern InputManager Input;
