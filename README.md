# Xiaomi WeChat Data Analyst Bot

A local WeChat group assistant built with Wechaty, DeepSeek, and APIMart. It keeps recent room messages in memory, summarizes them with DeepSeek, generates a poster with APIMart, and sends the poster back to the group when triggered.

## Features

- Keeps message history in RAM and drops messages older than 24 hours.
- Tracks each room by `roomId`, so multiple groups do not share memory.
- Supports text, image, link, emoticon, video, audio, attachment, and mini program message counts.
- Generates a structured JSON analysis first, then turns it into an image prompt.
- Preserves messages that arrive while a poster is being generated, so they can be included in the next summary.

## Requirements

- macOS
- Node.js 18 or newer
- A DeepSeek API key
- An APIMart API key
- A WeChat account that can log in through the configured Wechaty puppet

## Local Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and fill in:

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
APIMART_API_KEY=your_apimart_api_key_here
```

Optional settings are also documented in `.env.example`, including the trigger word and APIMart polling limits.

## Run

```bash
npm start
```

Scan the QR code printed in the terminal with WeChat. In a group chat, send the trigger word configured by `WECHAT_SUMMARY_TRIGGER`; the default is:

```text
#到点了兄弟
```

## Verify

```bash
npm run check
```

This runs syntax checks and the Node test suite.

## Notes

- API keys are loaded from environment variables or `.env`; do not commit real keys.
- `wechaty-puppet-wechat4u` can be sensitive to WeChat account state and WeChat Web availability. If login fails, first verify the account can use the Web WeChat flow required by the puppet.
