import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // 👈 necesario para enviar datos a HubSpot

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

// --- Función para enviar prospectos a HubSpot ---
async function createHubSpotContact(name, email, phone, message, address) {
  const url = "https://api.hubapi.com/crm/v3/objects/contacts";
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const contactData = {
    properties: {
      firstname: name || "Desconocido",
      email: email || `sin_email_${Date.now()}@noemail.com`,
      phone: phone || "",
      message_interes: message || "",
      lead_source: "Chatbot Alejandro iA",
      address: address || "", // 👈 nueva propiedad para dirección física
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(contactData),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("❌ Error al enviar a HubSpot:", err);
  } else {
    console.log("✅ Prospecto enviado a HubSpot con éxito.");
  }
}

// --- Función para obtener respuesta del asistente ---
async function obtenerRespuestaDeAlejandro(message, thread_id) {
  let thread = thread_id;

  if (!thread) {
    const threadResponse = await openai.beta.threads.create();
    thread = threadResponse.id;
  }

  await openai.beta.threads.messages.create(thread, {
    role: "user",
    content: message,
  });

  const run = await openai.beta.threads.runs.create(thread, {
    assistant_id: ASSISTANT_ID,
  });

  let completed = false;
  let output = "";

  while (!completed) {
    const runStatus = await openai.beta.threads.runs.retrieve(thread, run.id);

    if (runStatus.status === "completed") {
      const messages = await openai.beta.threads.messages.list(thread);
      const last = messages.data[0];
      output = last.content[0].text.value;
      completed = true;
    } else if (["failed", "expired", "cancelled"].includes(runStatus.status)) {
      completed = true;
      output = "Lo siento, algo falló en la respuesta del asistente 😔";
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return output;
}

// --- Endpoint principal del chat con integración HubSpot ---
app.post("/chat", async (req, res) => {
  try {
    const { message, name, email, phone, address, thread_id } = req.body;

    // Procesar respuesta del asistente
    const reply = await obtenerRespuestaDeAlejandro(message, thread_id);

    // Enviar prospecto a HubSpot con dirección incluida
    await createHubSpotContact(name, email, phone, message, address);

    res.json({ reply, thread_id });
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
