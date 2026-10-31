const { getSessionUser } = require('../services/authService.cjs');

async function authMiddleware(req, res, next) {
    const token = req.cookies.session || req.headers['x-session-token'];
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    try {
        const user = await getSessionUser(token);
        req.user = user;
    } catch (err) {
        req.user = null;
    }
    
    next();
}

function requireAuth(req, res, next) {
    if (!req.user) {
        const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                      (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
                      req.path.startsWith('/api/');
        if (isApi) {
            return res.status(401).json({ error: 'Authentication required' });
        } else {
            return res.redirect('/login/');
        }
    }
    next();
}

function requireOwner(req, res, next) {
    if (!req.user || req.user.role !== 'OWNER') {
        const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                      (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
                      req.path.startsWith('/api/');
        if (isApi) {
            return res.status(403).json({ error: 'Owner access required' });
        } else {
            return res.status(403).send('Forbidden: Owner access required');
        }
    }
    next();
}

const ROLE_PERMISSIONS = {
    OWNER: ['*'],
    ADMIN: [
        'users.read', 'users.write',
        'games.read', 'games.write', 'games.publish',
        'consoles.read', 'consoles.write',
        'media.read', 'media.write',
        'moderation.read', 'moderation.write',
        'ai.read', 'ai.execute',
        'content.write', 'content.publish',
        'support.read', 'support.write',
        'jobs.read', 'jobs.write',
        'analytics.read',
        'audit.read'
    ],
    EDITOR: [
        'games.read', 'games.write',
        'consoles.read', 'consoles.write',
        'media.read', 'media.write',
        'content.write', 'content.publish',
        'ai.read', 'ai.execute'
    ],
    MODERATOR: [
        'moderation.read', 'moderation.write',
        'users.read',
        'support.read', 'support.write',
        'comments.moderate'
    ],
    SUPPORT: [
        'support.read', 'support.write',
        'users.read'
    ],
    ANALYST: [
        'analytics.read',
        'games.read',
        'consoles.read',
        'users.read',
        'audit.read'
    ],
    USER: [
        'profile.read', 'profile.write', 'comments.create', 'reviews.create'
    ]
};

function hasPermission(user, permission) {
    if (!user) return false;
    const role = (user.role || 'USER').toUpperCase();
    if (role === 'OWNER') return true;

    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes('*') || perms.includes(permission)) return true;

    // Check custom permissions JSON if present
    if (user.custom_permissions) {
        try {
            const custom = typeof user.custom_permissions === 'string'
                ? JSON.parse(user.custom_permissions)
                : user.custom_permissions;
            if (Array.isArray(custom) && custom.includes(permission)) return true;
        } catch (_) {}
    }

    return false;
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                          (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
                          req.path.startsWith('/api/');
            if (isApi) {
                return res.status(401).json({ error: 'Authentication required' });
            } else {
                return res.redirect('/login/');
            }
        }

        if (!hasPermission(req.user, permission)) {
            const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                          (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
                          req.path.startsWith('/api/');
            if (isApi) {
                return res.status(403).json({
                    error: `Forbidden: Missing required permission "${permission}"`,
                    requiredPermission: permission,
                    userRole: req.user.role
                });
            } else {
                return res.status(403).send(`Forbidden: Missing required permission "${permission}"`);
            }
        }

        next();
    };
}

function requireRole(allowedRoles) {
    const roles = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(r => r.toUpperCase());
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userRole = (req.user.role || 'USER').toUpperCase();
        if (userRole === 'OWNER' || roles.includes(userRole)) {
            return next();
        }
        return res.status(403).json({
            error: `Forbidden: Requires one of roles [${roles.join(', ')}]`,
            userRole
        });
    };
}

module.exports = {
    authMiddleware,
    requireAuth,
    requireOwner,
    requirePermission,
    requireRole,
    hasPermission,
    ROLE_PERMISSIONS
};

