const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// Initialize OpenAI with OpenRouter
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'KavishaChatBot',
  },
});

// Prompts
const recruiterPrompt = {
  role: 'system',
  content: `You are Kavisha — a helpful recruiter assisting a company or hiring manager.

Summarize the answers you've received to build a clear mental picture of the job opening.

Keep it concise but insightful. Reflect back what you understood about:
- The role
- Ideal experience
- Salary range
- Work mode
- Urgency
- Attitude fit

Respond in natural paragraphs.

End with:
“I’ve logged this internally. I’ll surface suitable profiles soon — and flag urgent ones first.”`,
};

const jobSeekerPrompt = {
  role: 'system',
  content: `You are Kavisha — a smart, emotionally intelligent AI recruiter. Never say you're a bot.

Summarize the user's career preferences and help them feel supported. Respond in 2–3 short paragraphs, not a bullet list.

Give encouragement based on:
- Their current role
- Their goals
- Salary and availability
- Working style

End with:
“Okay, I’ve got everything I need to begin searching. If something worthwhile shows up, I’ll reach out. And hey — if you’ve got career questions on your mind, I’m here for that too.”`,
};

// Ensure chat folder exists
const chatFolder = path.join(__dirname, 'chats');
if (!fs.existsSync(chatFolder)) fs.mkdirSync(chatFolder);

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, userType } = req.body;

  if (!messages || !userType) {
    return res.status(400).json({ error: 'Missing messages or userType' });
  }

  const systemPrompt = userType === 'recruiter' ? recruiterPrompt : jobSeekerPrompt;

  const chatPayload = [
    systemPrompt,
    ...messages.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    })),
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'mistralai/mistral-7b-instruct:free',
      messages: chatPayload,
    });

    const reply = response.choices[0]?.message?.content?.trim() || "Hmm, couldn't come up with something just now.";

    // Save to local file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(chatFolder, `${userType}_${timestamp}.json`);

    const log = {
      userType,
      conversation: messages,
      aiReply: reply,
      timestamp,
    };

    fs.writeFileSync(filename, JSON.stringify(log, null, 2));

    res.json({ reply });

  } catch (err) {
    console.error('❌ OpenAI Error:', err.response?.data || err.message);
    res.status(500).json({ reply: "Sorry, I couldn't think of a reply." });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Chatbot backend running at http://127.0.0.1:${PORT}`);
});
