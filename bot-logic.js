import { WechatyBuilder } from 'wechaty';
import { FileBox } from 'file-box';
import OpenAI from 'openai';
import { getBotConfig, loadDotEnv } from './bot-config.js';

loadDotEnv();

let config;
try {
    config = getBotConfig();
} catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
}

// 1. DeepSeek Client (For Text Summaries)
const deepseek = new OpenAI({
    baseURL: config.deepseekBaseUrl,
    apiKey: config.deepseekApiKey
});

// The bot's internal memory! It will store messages here.
const roomMessageHistory = new Map();
const lastTriggerTimes = new Map();

console.log('🚀 Initializing Wechaty...');

const wechaty = WechatyBuilder.build({
    name: config.wechatyName,
    puppet: config.wechatyPuppet
});

wechaty.on('scan', (qrcode, status) => {
    console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
});

wechaty.on('login', user => {
    console.log(`Bot ${user.name()} logged in successfully!`);
});

// Handle incoming messages
wechaty.on('message', async (message) => {
    const room = message.room();
    const text = message.text();
    const talker = message.talker();

    if (room) {
        const topic = await room.topic() || 'Unknown Group';
        const roomId = room.id; // 👈 NEW: Get the globally unique ID for this specific WeChat group
        const now = Date.now();

        // Check if the message is our secret trigger word
        if (text === config.triggerWord) {
            console.log(`Export command detected in room: ${topic} by ${talker.name()}`);

            let sinceTimestamp = now - 24 * 60 * 60 * 1000; // Default: 24 hours ago
            
            // 👇 ADAPTED: Use roomId instead of topic to check memory
            if (lastTriggerTimes.has(roomId)) {
                const lastTime = lastTriggerTimes.get(roomId);
                if (lastTime > sinceTimestamp) {
                    sinceTimestamp = lastTime;
                }
            }

            // Run the summary! Notice we are passing roomId now too.
            const exportSucceeded = await exportRoomHistory(topic, roomId, room, sinceTimestamp, now);
            if (exportSucceeded) {
                lastTriggerTimes.set(roomId, now);
            }
            return; // Stop here so the trigger word itself isn't saved in history
        }

        // Determine what type of message it is so we can log photos, links, etc.
        let contentToSave = "";
        
        switch (message.type()) {
            case wechaty.Message.Type.Text:
                contentToSave = text;
                break;
            case wechaty.Message.Type.Image:
                contentToSave = "[发送了一张图片]";
                break;
            case wechaty.Message.Type.Url:
                try {
                    const urlLink = await message.toUrlLink();
                    contentToSave = `[分享了链接: ${urlLink.title()}]`;
                } catch (e) {
                    contentToSave = "[分享了一个网页链接]";
                }
                break;
            case wechaty.Message.Type.Emoticon:
                contentToSave = "[发送了一个表情包]";
                break;
            case wechaty.Message.Type.Video:
                contentToSave = "[发送了一段视频]";
                break;
            case wechaty.Message.Type.Audio:
                contentToSave = "[发送了一段语音]";
                break;
            case wechaty.Message.Type.Attachment:
                contentToSave = "[发送了一个文件]";
                break;
            case wechaty.Message.Type.MiniProgram:
                contentToSave = "[分享了一个小程序]";
                break;
        }

        // Only save the message if it's one of the types we recognized above!
        if (contentToSave !== "") {
            // 👇 ADAPTED: Use roomId to keep every single group's memory strictly isolated
            if (!roomMessageHistory.has(roomId)) {
                roomMessageHistory.set(roomId, []);
            }
            
            // Push the message into the array for this room
            roomMessageHistory.get(roomId).push({
                time: now,
                sender: talker.name(),
                content: contentToSave
            });
            console.log(`📥 Saved message in memory for [${topic}]: ${talker.name()}: ${contentToSave}`);

            // Auto-cleanup! Delete any messages older than 24 hours so your PC doesn't crash
            const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
            const cleanedHistory = roomMessageHistory.get(roomId).filter(msg => msg.time >= twentyFourHoursAgo);
            roomMessageHistory.set(roomId, cleanedHistory);
        }
    }
});

// 👇 ADAPTED: Add roomId to the function parameters
async function exportRoomHistory(roomTopic, roomId, room, sinceTimestamp, summaryUntilTimestamp) {
    await room.say('喵~ 收到！喵小助正在进行结构化数据分析并绘制海报，可能需要一分多钟，不要走开喵~ 🎨🐾');

    try {
        // 👇 ADAPTED: Grab messages from the bot's memory using the unique ID
        const allMessages = roomMessageHistory.get(roomId) || [];
        const recentMessages = allMessages.filter(
            msg => msg.time >= sinceTimestamp && msg.time <= summaryUntilTimestamp
        );

        if (recentMessages.length > 0) {
            const formattedChatLog = recentMessages.map(msg => {
                const date = new Date(msg.time);
                const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                return `[${timeString}] ${msg.sender}: ${msg.content}`;
            }).join('\n');

            console.log(`✅ Found ${recentMessages.length} messages in memory!`);

            // ==========================================
            // PART 1: DEEPSEEK EXTRACTS CHAT INTO JSON
            // ==========================================
            console.log('🤖 STEP 1: DeepSeek extracting chat history into structured JSON...');
            
            const prompt1_JSON = `你是一个“微信聊天记录数据分析助手”。我会提供一段微信群聊导出的聊天记录文本，请你只基于聊天记录本身进行统计、结构化整理和总结，不要编造数据。

你的任务是把聊天记录分析成一份适合生成可视化海报的数据报告。请重点统计：消息数量、图片数量、链接数量、活跃人员、活跃时段、热点话题、关键词、人际关系互动等。

请严格按以下规则处理：
1. 隐私与脱敏：不输出敏感信息。
2. 消息类型识别：识别文本、图片、链接等。
3. 人员活跃度：统计发送消息总数、角色标签。
4. 热点话题：提取核心话题与情绪。
5. 关键词：提取高频关键词。
6. 人际关系互动：分析核心互动关系。
7. 活跃时间：分析活跃时段。

请严格输出 JSON，不要输出解释性文字。JSON 结构必须如下：
{
  "overview": { "total_messages": 0, "image_messages": 0, "link_messages": 0, "active_users_count": 0, "total_days": 1 },
  "message_type_ratio": [{ "type": "文字", "ratio": "0%" }],
  "active_users": [{ "user": "脱敏昵称", "message_count": 0, "role_tags": ["标签"] }],
  "hot_topics": [{ "topic": "话题名称" }],
  "keywords": { "top_keywords": [{ "word": "关键词" }] },
  "relationship_graph": { "core_users": [], "summary": "一句话总结群内互动关系" }
}

请开始分析以下聊天记录（按时间正序排列）：
\n\n${formattedChatLog}`;

            const response1 = await deepseek.chat.completions.create({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "你是一个严格的数据分析工具，只输出合法的 JSON 格式字符串，不输出任何其他多余文本或 Markdown 标记。" },
                    { role: "user", content: prompt1_JSON }
                ]
            });
            
            let analysisJsonText = response1.choices[0].message.content.trim();
            // Clean up Markdown code blocks if DeepSeek adds them
            if (analysisJsonText.startsWith('```')) {
                analysisJsonText = analysisJsonText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            
            console.log(`✅ STEP 1 Complete! JSON generated successfully.`);

            // ==========================================
            // PART 2: DEEPSEEK GENERATES POSTER PROMPT
            // ==========================================
            console.log('🤖 STEP 2: DeepSeek converting JSON into Image Generation Prompt...');
            
            const prompt2_ImagePrompt = `你是一个信息可视化设计师。下面是一份微信群聊数据分析的 JSON 结构化数据。
请你基于这份 JSON 数据，严格按照下方的【海报视觉生成 Prompt 模板】，填入真实的统计数字和文本，并**直接且仅输出**一段用于 AI 绘画大模型的“图像生成 Prompt”。
切记：不要输出任何解释性的话语，不带 Markdown 格式代码块，只输出最终拼接好的完整 Prompt 文本。

【JSON 数据】
${analysisJsonText}

【海报视觉生成 Prompt 模板】
请设计一张中文竖版信息图海报，主题是“微信聊天记录分析报告”。

整体风格：
- 猫娘可爱风格
- Pastel kawaii dashboard
- 粉色、奶油白、薄荷绿、浅蓝主色
- 圆角卡片、柔和阴影、猫爪、聊天气泡、可爱图标
- 既像可爱的二次元海报，也像专业数据分析 Dashboard
- 信息清晰、层级明确、适合社群运营分析展示

画面元素：
- 左侧或底部有一位可爱的猫娘数据分析助手
- 猫娘有猫耳、猫尾、可爱笑容，穿科技感但柔和的粉白色服装
- 她正在介绍一块数据看板
- 海报上方是大标题《微信聊天记录分析海报》
- 中间是多个数据卡片
- 底部是隐私安全、本地分析、可视化呈现、智能洞察等功能图标
- 底部 slogan：用数据洞察群聊，让沟通更高效！

海报内容模块（请根据JSON中的真实数据填充以下内容，要求精准排版以便生成）：
1. 总览数据
- 总消息数：【填入真实数字】
- 图片数：【填入真实数字】
- 链接数：【填入真实数字】
- 活跃人数：【填入真实数字】

2. 活跃成员排行榜
- 【填入最活跃用户1】：【对应消息数】条（标签：【填入对应角色标签】）
- 【填入最活跃用户2】：【对应消息数】条（标签：【填入对应角色标签】）
- 【填入最活跃用户3】：【对应消息数】条（标签：【填入对应角色标签】）

3. 热点话题
- 【填入话题1名称】
- 【填入话题2名称】
- 【填入话题3名称】

4. 核心关键词云
- 【填入高频关键词1】 【关键词2】 【关键词3】 【关键词4】 【关键词5】 【关键词6】

5. 人际互动网
- 核心互动成员：【填入核心成员名单】
- 群聊特征结论：【填入人际互动特征结论】`;

            const response2 = await deepseek.chat.completions.create({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "你是严格的 Prompt 生成器，直接输出最终 Prompt 文本，不要任何 Markdown 代码块修饰。" },
                    { role: "user", content: prompt2_ImagePrompt }
                ]
            });

            const finalImagePrompt = response2.choices[0].message.content.trim();
            console.log(`✅ STEP 2 Complete! Image Prompt generated:\n${finalImagePrompt}\n`);

            // ==========================================
            // PART 3: APIMART GENERATES THE ACTUAL IMAGE
            // ==========================================
            console.log('🎨 STEP 3: Submitting exact Prompt to APIMart (gpt-image-2)...');
            
            const submitResponse = await fetch(`${config.apimartBaseUrl}/v1/images/generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apimartApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-image-2",
                    prompt: finalImagePrompt, // Output from Step 2 directly passed to APIMart
                    n: 1,
                    size: "9:16", // Vertical poster as requested in MD
                    resolution: "1k"
                })
            });

            const submitData = await submitResponse.json();
            
            if (!submitResponse.ok) {
                throw new Error(`APIMart submit request failed with HTTP ${submitResponse.status}: ${JSON.stringify(submitData)}`);
            }

            if (submitData.code !== 200 || !submitData.data || !submitData.data[0].task_id) {
                throw new Error('Failed to submit image task: ' + JSON.stringify(submitData));
            }

            const taskId = submitData.data[0].task_id;
            console.log(`⏳ Image task submitted (ID: ${taskId}). Waiting for APIMart to finish drawing...`);

            let imageUrl = null;
            for (let attempt = 0; attempt < config.apimartMaxPollAttempts && !imageUrl; attempt += 1) {
                await new Promise(resolve => setTimeout(resolve, config.apimartPollIntervalMs)); 
                
                const taskResponse = await fetch(`${config.apimartBaseUrl}/v1/tasks/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${config.apimartApiKey}` }
                });
                
                const taskData = await taskResponse.json();
                
                if (taskData.code === 200) {
                    const status = taskData.data.status;
                    if (status === 'completed') {
                        imageUrl = taskData.data.result.images[0].url[0];
                        break;
                    } else if (status === 'failed') {
                        throw new Error('APIMart image generation failed.');
                    } else {
                        console.log(`... Task status: ${status}. Still thinking ...`);
                    }
                } else {
                    console.log('... Checking status failed, retrying in 5s ...');
                }
            }

            if (!imageUrl) {
                throw new Error(`APIMart image generation timed out after ${config.apimartMaxPollAttempts} attempts.`);
            }
            
            console.log('✅ Poster generated! Downloading image to send to WeChat...');
            
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Generated image download failed with HTTP ${imageResponse.status}.`);
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Only the final completed image is sent!
            const fileBox = FileBox.fromBuffer(buffer, 'summary-poster.png');
            await room.say(fileBox);

            // 👇 ADAPTED: Clear the memory for this specific room ID after a successful summary
            const currentMessages = roomMessageHistory.get(roomId) || [];
            roomMessageHistory.set(
                roomId,
                currentMessages.filter(msg => msg.time > summaryUntilTimestamp)
            );

        } else {
            await room.say("小咪看过了，这期间群里静悄悄的，一条新消息都没有喵！💤");
        }

        return true;
    } catch (error) {
        console.error("❌ Failed to run AI or write the file.", error);
        await room.say("呜呜呜...小咪的系统好像卡住了，没能生成成功喵... 😿");
        return false;
    }
}

console.log('⏳ Starting the bot engine (this might take a moment)...');
wechaty.start()
    .then(() => console.log('✅ Engine started! Waiting to fetch QR code...'))
    .catch(e => console.error('❌ Failed to start bot engine:', e));
