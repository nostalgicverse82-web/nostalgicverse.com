#include "RTCService.h"

bool RTCService::begin() {
    _ok = _rtc.begin() && _rtc.isrunning();
    return _ok;
}

DateTime RTCService::now() {
    if (_ok) return _rtc.now();
    return DateTime((uint32_t)0);
}
