import { existsSync, readFileSync } from 'node:fs';

const DEFAULTS = {
    apimartBaseUrl: 'https://api.apimart.ai',
    deepseekBaseUrl: 'https://api.deepseek.com',
    triggerWord: '#到点了兄弟',
    wechatyName: 'xiaomi-bot',
    wechatyPuppet: 'wechaty-puppet-wechat4u',
    apimartPollIntervalMs: 5000,
    apimartMaxPollAttempts: 36
};

const PLACEHOLDER_VALUES = new Set([
    'YOUR_DEEPSEEK_API_KEY',
    'YOUR_APIMART_API_KEY',
    'your_deepseek_api_key_here',
    'your_apimart_api_key_here'
]);

export function parseDotEnv(source) {
    const values = {};

    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if (!key) {
            continue;
        }

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        values[key] = value;
    }

    return values;
}

export function loadDotEnv(filePath = '.env', env = process.env) {
    if (!existsSync(filePath)) {
        return {};
    }

    const values = parseDotEnv(readFileSync(filePath, 'utf8'));

    for (const [key, value] of Object.entries(values)) {
        if (env[key] === undefined) {
            env[key] = value;
        }
    }

    return values;
}

function requiredEnv(env, key) {
    const value = env[key]?.trim();

    if (!value || PLACEHOLDER_VALUES.has(value)) {
        throw new Error(`Missing ${key}. Add it to .env or export it before running the bot.`);
    }

    return value;
}

function positiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBotConfig(env = process.env) {
    return {
        apimartApiKey: requiredEnv(env, 'APIMART_API_KEY'),
        apimartBaseUrl: env.APIMART_BASE_URL || DEFAULTS.apimartBaseUrl,
        apimartMaxPollAttempts: positiveInteger(
            env.APIMART_MAX_POLL_ATTEMPTS,
            DEFAULTS.apimartMaxPollAttempts
        ),
        apimartPollIntervalMs: positiveInteger(
            env.APIMART_POLL_INTERVAL_MS,
            DEFAULTS.apimartPollIntervalMs
        ),
        deepseekApiKey: requiredEnv(env, 'DEEPSEEK_API_KEY'),
        deepseekBaseUrl: env.DEEPSEEK_BASE_URL || DEFAULTS.deepseekBaseUrl,
        triggerWord: env.WECHAT_SUMMARY_TRIGGER || DEFAULTS.triggerWord,
        wechatyName: env.WECHATY_NAME || DEFAULTS.wechatyName,
        wechatyPuppet: env.WECHATY_PUPPET || DEFAULTS.wechatyPuppet
    };
}
