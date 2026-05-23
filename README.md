🐾 Xiaomi (小咪) WeChat Data Analyst Bot

A fully automated WeChat group chat assistant built with Wechaty and AI.

When triggered, this bot reads the group's message history, acts as a "Catgirl Data Analyst", and uses DeepSeek + APIMart (gpt-image-2) to generate a beautiful, personalized, and visually stunning data dashboard poster directly in the chat!

✨ Features

Zero-Database Memory: Memorizes chat history in RAM, automatically wiping messages older than 24 hours to stay lightweight.

Smart Data Extraction: Uses DeepSeek to structure chaotic chat logs into clean JSON data (counting messages, images, links, active users, and hot topics).

AI Poster Generation: Feeds the structured JSON into an image generator to draw a pastel kawaii dashboard summarizing the group's activity.

Multi-Group Support: Safely isolates memories using unique roomId tracking, allowing the bot to manage multiple groups simultaneously.

🚀 How to Run

Clone this repository to your local machine.

Install dependencies:

npm install


Open bot-exporter.js and add your DeepSeek API Key and APIMart API Key at the top.

Run the bot:

node bot-exporter.js


Scan the QR code with your WeChat app to log in.

In any group chat, type your choice of code to trigger the AI summary!

⚠️ Disclaimer

Please remember to respect privacy when using chat history bots. Do not upload your personal API keys to public repositories.