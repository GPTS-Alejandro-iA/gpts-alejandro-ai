import express from 'express';
import { OpenAI } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// SIRVE EL INDEX.HTML Y TODOS LOS ARCHIVOS ESTÁTICOS
app.use(express.static('.'));

// RUTA DE RESPALDO POR SI ALGUIEN ENTRA DIRECTO A /
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = "asst_XXXXXXXXXXXXXXXXXXXXXXXX"; // ← TU ID REAL AQUÍ

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
    console.error(error);
    res.status(500).json({ reply: "Error temporal, intenta de nuevo en segundos." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Alejandro AI corriendo en puerto ${PORT}`);
});
