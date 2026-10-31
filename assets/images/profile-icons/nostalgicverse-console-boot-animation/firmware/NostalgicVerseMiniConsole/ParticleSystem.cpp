#include "ParticleSystem.h"
#include <Arduino.h>
#include <math.h>

void ParticleSystem::init()     { clearAll(); }
void ParticleSystem::clearAll() { for (auto &p : _pool) p.active = false; }

int ParticleSystem::findFree() {
    for (int i = 0; i < MAX_PARTICLES; i++)
        if (!_pool[i].active) return i;
    return -1;
}

void ParticleSystem::spawnBurst(float cx, float cy, uint8_t count,
                                 float speedMin, float speedMax, int16_t life) {
    for (uint8_t i = 0; i < count; i++) {
        int idx = findFree();
        if (idx < 0) return;
        Particle &p = _pool[idx];
        float angle = (float)random(0, 360) * (PI / 180.0f);
        float speed = speedMin + (random(0, 100) / 100.0f) * (speedMax - speedMin);
        p.x = cx; p.y = cy;
        p.vx = cosf(angle) * speed;
        p.vy = sinf(angle) * speed;
        p.homing = false;
        p.life = life; p.maxLife = life;
        p.active = true;
    }
}

void ParticleSystem::spawnHoming(float sx, float sy, float tx, float ty, int16_t life) {
    int idx = findFree();
    if (idx < 0) return;
    Particle &p = _pool[idx];
    p.x = sx; p.y = sy;
    p.tx = tx; p.ty = ty;
    p.homing = true;
    p.vx = 0; p.vy = 0;
    p.life = life; p.maxLife = life;
    p.active = true;
}

void ParticleSystem::update(uint16_t dtMs) {
    float dt = dtMs / 1000.0f;
    for (auto &p : _pool) {
        if (!p.active) continue;
        if (p.homing) {
            p.x += (p.tx - p.x) * 8.0f * dt;
            p.y += (p.ty - p.y) * 8.0f * dt;
        } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96f;
            p.vy *= 0.96f;
        }
        p.life -= dtMs;
        if (p.life <= 0) p.active = false;
    }
}

void ParticleSystem::draw(DisplayManager& disp) {
    auto &oled = disp.raw();
    for (auto &p : _pool) {
        if (!p.active) continue;
        int16_t x = (int16_t)p.x;
        int16_t y = (int16_t)p.y;
        if (x < 0 || y < 0 || x >= disp.width() || y >= disp.height()) continue;
        oled.drawPixel(x, y, SSD1306_WHITE);
    }
}

uint8_t ParticleSystem::activeCount() const {
    uint8_t c = 0;
    for (auto &p : _pool) if (p.active) c++;
    return c;
}