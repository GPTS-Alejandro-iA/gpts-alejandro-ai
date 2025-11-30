import express from 'express';
import { OpenAI } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.get('*', (req, res) => res.sendFile('index.html', { root: 'public' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = "asst_pWq1M4v688jqCMtWxbliz9m9";

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

    await openai.beta.threads.messages.create(threadId, { role: "user", content: message });

    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // BUCLE MANUAL QUE EJECUTA LAS TOOLS AUTOMÁTICAMENTE
    while (run.status === "requires_action" || run.status === "in_progress" || run.status === "queued") {
      if (run.status === "requires_action") {
        const tools = run.required_action.submit_tool_outputs;
        const toolOutputs = tools.map(tool => ({
          tool_call_id: tool.id,
          output: "Lead capturado correctamente"  // aquí puedes poner JSON si necesitas más datos
        }));
        run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: toolOutputs });
      }
      await new Promise(r => setTimeout(r, 800)); // espera 800ms
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId);
      const reply = messages.data[0].content[0].text.value;
      res.json({ reply });
    } else {
      res.json({ reply: "Lo siento, algo falló. ¿Podemos intentarlo de nuevo?" });
    }

  } catch (error) {
    console.error("Error:", error.message);
    res.json({ reply: "Error temporal. Intenta de nuevo en segundos." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Alejandro AI corriendo en puerto ${PORT}`));
