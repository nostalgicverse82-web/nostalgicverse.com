#pragma once
#include <RTClib.h>

class RTCService {
public:
    bool begin();
    bool isHealthy() const { return _ok; }
    DateTime now();

private:
    RTC_DS1307 _rtc;
    bool _ok = false;
};