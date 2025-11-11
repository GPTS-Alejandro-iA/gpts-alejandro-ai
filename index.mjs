import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Inicializa OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PORT = process.env.PORT || 10000;

// 🧠 Ruta principal
app.get("/", (req, res) => {
  res.send(`
    <h1>🤖 Alejandro iA - Chatbot operativo</h1>
    <p>Visita <a href="/qr">/qr</a> para vincular WhatsApp Business</p>
    <p><b>Comandos supervisor:</b> @ia on | @ia off | @ia estado</p>
  `);
});

// 💬 Endpoint principal del chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    console.log("📩 Mensaje recibido:", message);

    // Crea un hilo de conversación
    const thread = await client.beta.threads.create({
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    // Ejecuta el asistente personalizado (Alejandro iA)
    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: "asst_fUNT2sPlWS7LYmNqrU9uHKoU",
    });

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(thread.id);
      const respuesta = messages.data[0].content[0].text.value;
      console.log("🤖 Respuesta (Alejandro iA):", respuesta);
      res.json({ reply: respuesta });
    } else {
      res.json({
        reply:
          "Estoy procesando tu mensaje, por favor intenta de nuevo en unos segundos.",
      });
    }
  } catch (error) {
    console.error("❌ Error en /api/chat:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 🔗 Puerto
app.listen(PORT, () => {
  console.log(`🚀 Servidor de Alejandro iA corriendo en puerto ${PORT}`);
});
