const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../../server/db/index.cjs');

async function runTests() {
    console.log('--- Phase 04 Validation ---');
    
    const errors = [];
    
    // 1. Check if avatar_id exists in users table
    const tableInfo = await dbAsync.all("PRAGMA table_info(users)");
    const hasAvatarId = tableInfo.some(col => col.name === 'avatar_id');
    const hasForcePassword = tableInfo.some(col => col.name === 'force_password_change');
    
    if (!hasAvatarId) errors.push('users table is missing avatar_id column.');
    if (!hasForcePassword) errors.push('users table is missing force_password_change column.');
    
    // 2. Check profile-icons.json registry
    const registryPath = path.resolve(__dirname, '../../data/profile-icons.json');
    if (!fs.existsSync(registryPath)) {
        errors.push('data/profile-icons.json registry is missing.');
    } else {
        const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        if (!Array.isArray(data) || data.length !== 50) {
            errors.push('Registry does not contain 50 avatars.');
        } else {
            if (!data[0].id || !data[0].path) {
                errors.push('Registry objects lack required fields (id, path).');
            }
        }
    }
    
    // 3. Check avatar-picker CSS/JS
    const cssPath = path.resolve(__dirname, '../../assets/css/avatar-picker.css');
    const jsPath = path.resolve(__dirname, '../../assets/js/avatar-picker.js');
    if (!fs.existsSync(cssPath)) errors.push('avatar-picker.css is missing.');
    if (!fs.existsSync(jsPath)) errors.push('avatar-picker.js is missing.');
    
    // 4. Check auth-ui.js logic
    const authUiStr = fs.readFileSync(path.resolve(__dirname, '../../assets/js/auth-ui.js'), 'utf8');
    if (!authUiStr.includes('AvatarPicker')) errors.push('auth-ui.js is missing AvatarPicker integration.');
    if (!authUiStr.includes('force_password_change')) errors.push('auth-ui.js is missing force_password_change logic.');
    
    if (errors.length > 0) {
        console.error('Validation FAILED:');
        errors.forEach(e => console.error('- ' + e));
        process.exit(1);
    } else {
        console.log('Validation PASSED: All Phase 04 requirements met.');
        process.exit(0);
    }
}

runTests().catch(e => { console.error(e); process.exit(1); });

