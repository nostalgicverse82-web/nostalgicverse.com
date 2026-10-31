#pragma once

// Real hardware state only. Never faked.
struct SystemDiagnostics {
    bool displayOK = false;
    bool rtcOK     = false;
    bool wifiOK    = false;
    bool btOK      = false;
    bool inputOK   = false;
    bool audioOK   = false;
    bool storageOK = false; // no SD module wired yet — architecture-ready placeholder
};