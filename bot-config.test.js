import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBotConfig, parseDotEnv } from './bot-config.js';

test('parseDotEnv reads comments, quoted values, and plain values', () => {
    assert.deepEqual(
        parseDotEnv(`
# local settings
DEEPSEEK_API_KEY="deepseek-key"
APIMART_API_KEY='apimart-key'
WECHAT_SUMMARY_TRIGGER=#summary
IGNORED_LINE
`),
        {
            DEEPSEEK_API_KEY: 'deepseek-key',
            APIMART_API_KEY: 'apimart-key',
            WECHAT_SUMMARY_TRIGGER: '#summary'
        }
    );
});

test('getBotConfig applies defaults and custom trigger', () => {
    const config = getBotConfig({
        APIMART_API_KEY: 'apimart-key',
        DEEPSEEK_API_KEY: 'deepseek-key',
        WECHAT_SUMMARY_TRIGGER: '#summary'
    });

    assert.equal(config.apimartBaseUrl, 'https://api.apimart.ai');
    assert.equal(config.deepseekBaseUrl, 'https://api.deepseek.com');
    assert.equal(config.triggerWord, '#summary');
    assert.equal(config.wechatyPuppet, 'wechaty-puppet-wechat4u');
});

test('getBotConfig rejects missing or placeholder API keys', () => {
    assert.throws(
        () => getBotConfig({ APIMART_API_KEY: 'apimart-key' }),
        /DEEPSEEK_API_KEY/
    );

    assert.throws(
        () =>
            getBotConfig({
                APIMART_API_KEY: 'apimart-key',
                DEEPSEEK_API_KEY: 'your_deepseek_api_key_here'
            }),
        /DEEPSEEK_API_KEY/
    );
});
