import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// --- Configura tu asistente real ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = "asst_fUNT2sPlWS7LYmNqrU9uHKoU"; // <--- Tu asistente real

// --- Endpoint principal del chat ---
app.post("/chat", async (req, res) => {
  try {
    const { message, thread_id } = req.body;

    let thread = thread_id;

    if (!thread) {
      const threadResponse = await openai.beta.threads.create();
      thread = threadResponse.id;
    }

    // Añadimos el mensaje del usuario al hilo
    await openai.beta.threads.messages.create(thread, {
      role: "user",
      content: message,
    });

    // Ejecutamos el asistente
    const run = await openai.beta.threads.runs.create(thread, {
      assistant_id: ASSISTANT_ID,
    });

    // Esperamos la respuesta del asistente
    let completed = false;
    let output = "";

    while (!completed) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread, run.id);

      if (runStatus.status === "completed") {
        const messages = await openai.beta.threads.messages.list(thread);
        const last = messages.data[0];
        output = last.content[0].text.value;
        completed = true;
      } else if (
        ["failed", "expired", "cancelled"].includes(runStatus.status)
      ) {
        completed = true;
        output = "Lo siento, algo falló en la respuesta del asistente 😔";
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    res.json({ reply: output, thread_id: thread });
  } catch (err) {
    console.error("❌ Error en /chat:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Servir HTML ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Inicia el servidor ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌞 WebChat de Alejandro iA activo en puerto ${PORT}`);
});
