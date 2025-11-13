// index.mjs
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import nodemailer from "nodemailer";
import OpenAI from "openai";

const app = express();
app.use(express.json());
app.use(cors());

// ============================
// 🔧 CONFIGURACIÓN
// ============================

// Variables de entorno
const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

// Configurar Nodemailer (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // tu cuenta Gmail
    pass: process.env.GMAIL_PASS, // contraseña de aplicación
  },
});

// ============================
// 🚀 CLIENTE DE OPENAI
// ============================
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ============================
// 🧠 ENDPOINT PRINCIPAL /chat
// ============================
app.post("/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) return res.status(400).json({ error: "Mensaje vacío." });

    // --- Mantener thread por usuario ---
    const threadKey = `thread_${userId || "default"}`;
    if (!global[threadKey]) {
      const newThread = await openai.beta.threads.create();
      global[threadKey] = newThread.id;
      console.log(`🧵 Nuevo hilo creado para usuario ${userId || "default"} (${newThread.id})`);
    }
    const threadId = global[threadKey];

    // --- Crear mensaje del usuario ---
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // --- Ejecutar asistente ---
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // --- Esperar respuesta del asistente ---
    let runStatus;
    do {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    } while (runStatus.status !== "completed" && runStatus.status !== "failed");

    if (runStatus.status === "failed")
      throw new Error("El asistente no pudo generar respuesta.");

    // --- Obtener respuesta final ---
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0]?.content?.[0]?.text?.value || "Sin respuesta.";

    // ================================
    // 📬 CAPTURA Y ENVÍO DE LEADS
    // ================================
    const nameMatch = message.match(
      /(soy|me llamo|nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i
    );
    const phoneMatch = message.match(/\+?\d{7,15}/);
    const emailMatch = message.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i
    );

    const name = nameMatch ? nameMatch[2] : "Cliente";
    const phone = phoneMatch ? phoneMatch[0] : "";
    const email = emailMatch ? emailMatch[0] : `${Date.now()}@temporal.com`;

    if (name || phone || email) {
      console.log(`📬 Nuevo lead detectado: ${name}`);

      // --- Enviar a HubSpot ---
      const hubspotRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
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
          },
        }),
      });

      const hubspotData = await hubspotRes.json();
      console.log("✅ Lead enviado a HubSpot:", hubspotData);

      // --- Enviar notificación por correo ---
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER, // Tu propio correo para recibir notificaciones
        subject: `📩 Nuevo Lead desde Alejandro iA: ${name}`,
        text: `Nuevo lead detectado:\n\nNombre: ${name}\nTeléfono: ${phone}\nEmail: ${email}\n\nMensaje original:\n"${message}"`,
      };

      await transporter.sendMail(mailOptions);
      console.log("✉️ Notificación de lead enviada por Gmail.");
    }

    // --- Responder al cliente final ---
    res.json({ reply });
  } catch (error) {
    console.error("❌ Error en /chat:", error);
    res.status(500).json({
      error: "Error interno en el servidor",
      details: error.message,
    });
  }
});

// ============================
// 🌐 Servidor activo
// ============================
app.listen(PORT, () => {
  console.log(`🌞 Alejandro iA WebChat corriendo en puerto ${PORT}`);
});
