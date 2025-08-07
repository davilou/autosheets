module.exports = {

"[project]/.next-internal/server/app/api/auth/login/route/actions.js [app-rsc] (server actions loader, ecmascript)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
}}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}}),
"[externals]/crypto [external] (crypto, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}}),
"[externals]/buffer [external] (buffer, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}}),
"[externals]/stream [external] (stream, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}}),
"[externals]/util [external] (util, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}}),
"[project]/src/lib/security/config.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

// Configurações de segurança baseadas no OWASP Top 10
__turbopack_context__.s({
    "SECURITY_CONFIG": ()=>SECURITY_CONFIG,
    "SHEETS_CONFIG": ()=>SHEETS_CONFIG,
    "TELEGRAM_CONFIG": ()=>TELEGRAM_CONFIG
});
const SECURITY_CONFIG = {
    // Rate limiting
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000,
        max: 100
    },
    // JWT Configuration
    JWT: {
        expiresIn: '24h',
        algorithm: 'HS256'
    },
    // Password requirements
    PASSWORD: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
    },
    // CORS settings
    CORS: {
        origin: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : [
            'http://localhost:3000'
        ],
        credentials: true
    },
    // Security headers
    HEADERS: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
};
const TELEGRAM_CONFIG = {
    MAX_MESSAGE_LENGTH: 4096,
    ALLOWED_CHAT_TYPES: [
        'group',
        'supergroup'
    ],
    RATE_LIMIT_PER_CHAT: 30
};
const SHEETS_CONFIG = {
    MAX_ROWS_PER_BATCH: 1000,
    RETRY_ATTEMPTS: 3,
    TIMEOUT_MS: 30000
};
}),
"[project]/src/lib/auth/service.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/bcryptjs/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jsonwebtoken$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jsonwebtoken/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/config.ts [app-route] (ecmascript)");
;
;
;
class AuthService {
    users = [];
    jwtSecret;
    constructor(){
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';
        this.initializeMockUsers();
    }
    initializeMockUsers() {
        // Usuário admin padrão para desenvolvimento
        const adminUser = {
            id: '1',
            email: 'admin@autosheets.com',
            username: 'admin',
            password: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].hashSync('Admin123!', 10),
            role: 'admin',
            createdAt: new Date()
        };
        this.users.push(adminUser);
    }
    async register(data) {
        try {
            // Validar se email já existe
            if (this.users.find((u)=>u.email === data.email)) {
                return {
                    success: false,
                    message: 'Email já cadastrado'
                };
            }
            // Validar se username já existe
            if (this.users.find((u)=>u.username === data.username)) {
                return {
                    success: false,
                    message: 'Username já cadastrado'
                };
            }
            // Validar força da senha
            if (!this.isPasswordStrong(data.password)) {
                return {
                    success: false,
                    message: 'Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial'
                };
            }
            // Criar novo usuário
            const hashedPassword = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].hash(data.password, 10);
            const newUser = {
                id: (this.users.length + 1).toString(),
                email: data.email,
                username: data.username,
                password: hashedPassword,
                role: 'user',
                telegramUserId: data.telegramUserId,
                createdAt: new Date()
            };
            this.users.push(newUser);
            const { password, ...userWithoutPassword } = newUser;
            return {
                success: true,
                message: 'Usuário criado com sucesso',
                user: userWithoutPassword
            };
        } catch (error) {
            console.error('Erro no registro:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
    async login(credentials) {
        try {
            const user = this.users.find((u)=>u.email === credentials.email);
            if (!user) {
                return {
                    success: false,
                    message: 'Credenciais inválidas'
                };
            }
            const isPasswordValid = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].compare(credentials.password, user.password);
            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Credenciais inválidas'
                };
            }
            // Atualizar último login
            user.lastLogin = new Date();
            // Gerar JWT token
            const token = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jsonwebtoken$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].sign({
                userId: user.id,
                email: user.email,
                role: user.role
            }, this.jwtSecret, {
                expiresIn: '24h'
            });
            const { password, ...userWithoutPassword } = user;
            return {
                success: true,
                message: 'Login realizado com sucesso',
                token,
                user: userWithoutPassword
            };
        } catch (error) {
            console.error('Erro no login:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
    async verifyToken(token) {
        try {
            const decoded = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jsonwebtoken$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].verify(token, this.jwtSecret);
            const user = this.users.find((u)=>u.id === decoded.userId);
            if (!user) {
                return {
                    valid: false
                };
            }
            const { password, ...userWithoutPassword } = user;
            return {
                valid: true,
                user: userWithoutPassword
            };
        } catch (error) {
            return {
                valid: false
            };
        }
    }
    isPasswordStrong(password) {
        const config = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECURITY_CONFIG"].PASSWORD;
        if (password.length < config.minLength) return false;
        if (config.requireUppercase && !/[A-Z]/.test(password)) return false;
        if (config.requireLowercase && !/[a-z]/.test(password)) return false;
        if (config.requireNumbers && !/\d/.test(password)) return false;
        if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
        return true;
    }
    getUserByTelegramId(telegramUserId) {
        return this.users.find((u)=>u.telegramUserId === telegramUserId);
    }
    getAllUsers() {
        return this.users.map(({ password, ...user })=>user);
    }
}
const __TURBOPACK__default__export__ = AuthService;
}),
"[project]/src/app/api/auth/login/route.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "POST": ()=>POST
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/service.ts [app-route] (ecmascript)");
;
;
const authService = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"]();
async function POST(request) {
    try {
        const body = await request.json();
        const { email, password } = body;
        if (!email || !password) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                message: 'Email e senha são obrigatórios'
            }, {
                status: 400
            });
        }
        const result = await authService.login({
            email,
            password
        });
        if (result.success) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result, {
                status: 200
            });
        } else {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result, {
                status: 401
            });
        }
    } catch (error) {
        console.error('Erro na API de login:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            message: 'Erro interno do servidor'
        }, {
            status: 500
        });
    }
}
}),

};

//# sourceMappingURL=%5Broot-of-the-server%5D__a43a5987._.js.map