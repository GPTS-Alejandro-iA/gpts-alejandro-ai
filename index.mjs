import express from 'express';
import { OpenAI } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // sirve index.html

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = "asst_TU_ID_REAL_AQUI"; // ← PON AQUÍ TU ID DEL ASSISTANT

// Mapa de sesiones (thread_id por sessionId del frontend)
const sessions = new Map();

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    let threadId = sessions.get(sessionId);

    // Si no existe thread → crear uno nuevo
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      sessions.set(sessionId, threadId);
    }

    // 1. Añadir mensaje del usuario
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });

    // 2. Crear run y esperar respuesta (SIN tocar el thread mientras corre)
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
      res.json({ reply: "Lo siento, estoy teniendo problemas técnicos. Intenta de nuevo en unos segundos." });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Error interno. Reintentando…" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Alejandro AI corriendo en puerto ${PORT}`);
});
