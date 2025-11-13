import express from "express";
import fetch from "node-fetch";
import OpenAI from "openai";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

// === 🔑 CONFIGURACIONES ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const ASSISTANT_ID = "asst_fUNT2sPlWS7LYmNqrU9uHKoU"; // Tu asistente personalizado

// === 🌞 RUTA PRINCIPAL ===
app.get("/", (req, res) => {
  res.send("✅ Alejandro iA WebChat activo y conectado correctamente.");
});

// === 💬 ENDPOINT DE CHAT ===
app.post("/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) return res.status(400).json({ error: "Mensaje vacío." });
    if (!userId) return res.status(400).json({ error: "Falta userId." });

    // 🧠 MANTENER UN THREAD POR USUARIO
    const threadKey = `thread_${userId}`;
    if (!global[threadKey]) {
      const newThread = await openai.beta.threads.create();
      global[threadKey] = newThread.id;
      console.log(`🧵 Nuevo hilo creado para ${userId}: ${newThread.id}`);
    }
    const threadId = global[threadKey];

    // Crear mensaje del usuario
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Ejecutar el asistente
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Esperar a que termine
    let runStatus;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    } while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed"
    );

    if (runStatus.status === "failed") {
      console.error("❌ Falló la ejecución del asistente:", runStatus.last_error);
      throw new Error("El asistente no pudo generar una respuesta.");
    }

    // Obtener último mensaje del asistente
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply =
      messages.data
        .find((msg) => msg.role === "assistant")
        ?.content?.[0]?.text?.value || "Sin respuesta.";

    // === 📬 CAPTURA DE LEADS AUTOMÁTICA ===
    const nameMatch = message.match(
      /(soy|me llamo|nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i
    );
    const phoneMatch = message.match(/\+?\d{7,15}/);
    const emailMatch = message.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i
    );

    if (nameMatch || phoneMatch || emailMatch) {
      const name = nameMatch ? nameMatch[2] : "Cliente";
      const phone = phoneMatch ? phoneMatch[0] : "";
      const email = emailMatch ? emailMatch[0] : `${Date.now()}@temporal.com`;

      console.log(`📥 Nuevo lead detectado: ${name} (${phone})`);

      await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            firstname: name,
            phone,
            email,
            lifecyclestage: "lead",
            source: "Chat Alejandro iA Web",
          },
        }),
      });
    }

    // === 🧾 RESPUESTA ===
    res.json({ reply });
  } catch (error) {
    console.error("❌ Error en /chat:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    });
  }
});

// === 🚀 INICIAR SERVIDOR ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌞 Alejandro iA WebChat corriendo en puerto ${PORT}`);
});
