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

// === 🌞 RUTA PRINCIPAL DE PRUEBA ===
app.get("/", (req, res) => {
  res.send("✅ Alejandro iA WebChat activo y conectado.");
});

// === 💬 CHAT ENDPOINT ===
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Mensaje vacío." });
    }

    // === 🧠 Crear hilo y mensaje para el asistente ===
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    // Esperar a que termine la ejecución
    let runStatus;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    } while (runStatus.status !== "completed");

    const messages = await openai.beta.threads.messages.list(thread.id);
    const reply = messages.data[0]?.content?.[0]?.text?.value || "No hubo respuesta.";

    // === 🧲 CAPTURA AUTOMÁTICA DE LEADS ===
    const nameMatch = message.match(/(soy|me llamo|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
    const phoneMatch = message.match(/\+?\d{7,15}/);

    if (nameMatch || emailMatch || phoneMatch) {
      const name = nameMatch ? nameMatch[2] : "Cliente sin nombre";
      const email = emailMatch ? emailMatch[0] : undefined;
      const phone = phoneMatch ? phoneMatch[0] : undefined;

      console.log(`📬 Nuevo lead detectado: ${name}`);

      await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            firstname: name,
            email: email || `${Date.now()}@temporal.com`,
            phone: phone || "",
            lifecyclestage: "lead",
            source: "Chat Alejandro iA Web",
          },
        }),
      });
    }

    res.json({ reply });
  } catch (error) {
    console.error("❌ Error en /chat:", error);
    res.status(500).json({
      error: "Error interno en el servidor",
      details: error.message,
    });
  }
});

// === 🚀 INICIAR SERVIDOR ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌞 Alejandro iA WebChat activo en puerto ${PORT}`);
});
