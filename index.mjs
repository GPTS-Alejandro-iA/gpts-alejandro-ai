import express from 'express';
import { OpenAI } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// SIRVE TODO DESDE LA CARPETA public (tu index.html está ahí)
app.use(express.static('public'));
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ⚠️ AQUÍ PON TU ASSISTANT ID REAL (ej: asst_abc123xyz...)
const ASSISTANT_ID = "asst_XXXXXXXXXXXXXXXXXXXXXXXX"; // ← CAMBIA ESTO

const sessions = new Map();

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    let threadId = sessions.get(sessionId);

    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      sessions.set(sessionId, threadId);
    }

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(threadId);
      const assistantMsg = messages.data
        .filter(m => m.role === 'assistant')
        .sort((a, b) => b.created_at - a.created_at)[0];

      res.json({ reply: assistantMsg.content[0].text.value });
    } else {
      res.json({ reply: "Estoy procesando tu mensaje, dame un segundo…" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ reply: "Error temporal. Intenta de nuevo en segundos." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Alejandro AI corriendo en puerto ${PORT}`);
});
