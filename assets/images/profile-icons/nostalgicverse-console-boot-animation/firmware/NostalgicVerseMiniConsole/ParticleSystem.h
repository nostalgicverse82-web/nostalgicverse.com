#pragma once
#include <stdint.h>
#include "Config.h"
#include "DisplayManager.h"

// Fixed-size pool. No dynamic allocation, ever.
struct Particle {
    float x, y;
    float vx, vy;
    float tx, ty;     // homing target (used if homing == true)
    bool homing;
    int16_t life;
    int16_t maxLife;
    bool active;
};

class ParticleSystem {
public:
    void init();
    void clearAll();
    void update(uint16_t dtMs);
    void draw(DisplayManager& disp);

    void spawnBurst(float cx, float cy, uint8_t count,
                     float speedMin, float speedMax, int16_t life);
    void spawnHoming(float sx, float sy, float tx, float ty, int16_t life);

    uint8_t activeCount() const;

private:
    Particle _pool[MAX_PARTICLES];
    int findFree();
};