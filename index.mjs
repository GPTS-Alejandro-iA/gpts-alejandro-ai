import express from "express";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Página principal del chat (HTML)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 💬 Endpoint del chatbot
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === "")
    return res.status(400).json({ error: "Mensaje vacío" });

  try {
    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: message }],
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: "asst_fUNT2sPlWS7LYmNqrU9uHKoU",
    });

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(thread.id);
      const respuesta = messages.data[0].content[0].text.value;
      res.json({ reply: respuesta });
    } else {
      res.json({
        reply:
          "Alejandro iA está procesando tu mensaje, por favor intenta de nuevo.",
      });
    }
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Error al conectar con Alejandro iA." });
  }
});

app.listen(port, () => {
  console.log(`🌞 WebChat de Alejandro iA activo en puerto ${port}`);
});
