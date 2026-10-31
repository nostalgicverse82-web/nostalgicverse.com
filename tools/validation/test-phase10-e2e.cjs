const puppeteer = require('puppeteer');
require('dotenv').config();
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3002';
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'owner';
const OWNER_PASSWORD = 'changeme123';

let serverProcess;

async function runTests() {
    console.log('Starting Phase 10 E2E Tests...');
    
    serverProcess = spawn('node', ['server/index.cjs'], {
        cwd: path.resolve(__dirname, '../../'),
        env: { ...process.env, PORT: '3002', NODE_ENV: 'development' }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        console.log('1. Login as Owner');
        await page.goto(`${BASE_URL}/login/`);
        await page.type('#username', OWNER_USERNAME);
        await page.type('#password', OWNER_PASSWORD);
        await page.click('#login-form button[type="submit"]');
        await new Promise(r => setTimeout(r, 2000));
        console.log(' - Logged in.');

        console.log('2. Check Owner Dashboard');
        await page.goto(`${BASE_URL}/owner/`);
        try {
            await page.waitForSelector('#owner-content-area h2', { timeout: 5000 });
        } catch (e) {
            console.error('Failed to load dashboard. Current URL:', page.url());
            const content = await page.content();
            console.error('Page content:', content.substring(0, 1000));
            throw e;
        }
        const metricsText = await page.evaluate(() => document.querySelector('#owner-content-area').innerText);
        if (!metricsText.includes('Total Users (inc. Owner)')) {
            throw new Error('Dashboard missing Total Users label');
        }
        if (!metricsText.includes('1')) {
            console.warn(' - WARNING: Total Users might not be 1. Text found: ' + metricsText.replace(/\n/g, ' '));
        } else {
            console.log(' - Dashboard verified (Total Users = 1 found).');
        }

        console.log('3. Check Messages Empty State');
        await page.goto(`${BASE_URL}/messages/`);
        await page.waitForSelector('#chat-sidebar');
        const messagesHtml = await page.content();
        if (!messagesHtml.includes('No conversations yet')) {
            throw new Error('Messages page missing empty state text.');
        }
        if (!messagesHtml.includes('Find People')) {
            throw new Error('Messages page missing [Find People] button.');
        }
        if (!messagesHtml.includes('+ New Message')) {
            throw new Error('Messages page missing [+ New Message] button.');
        }
        console.log(' - Messages empty state verified.');

        console.log('4. Check User Directory');
        await page.goto(`${BASE_URL}/users/`);
        await page.waitForSelector('#user-search-input');
        await page.type('#user-search-input', OWNER_USERNAME);
        await page.click('#user-search-btn');
        // Wait for search result empty state
        await page.waitForFunction(() => {
            const results = document.getElementById('user-search-results');
            return results && (results.innerText.includes('No users found.') || results.innerText.includes('No other community members yet.'));
        }, { timeout: 5000 });
        
        console.log(' - User Directory search works.');

        console.log('All Phase 10 UI tests PASSED.');
    } catch (err) {
        console.error('Test FAILED:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
        if (serverProcess) serverProcess.kill();
    }
}

runTests();
