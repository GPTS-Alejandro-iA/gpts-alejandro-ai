import express from "express";
import fetch from "node-fetch";
import OpenAI from "openai";
import bodyParser from "body-parser";
import dotenv from "dotenv";
// import sgMail from "@sendgrid/mail"; // <- Activar más adelante si usamos correos

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

// Si luego usamos correo, activar esto:
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// === 🌞 RUTA PRINCIPAL DE PRUEBA ===
app.get("/", (req, res) => {
  res.send("✅ Alejandro iA WebChat activo y conectado.");
});

// === 💬 CHAT ENDPOINT ===
app.post("/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Mensaje vacío." });
    }

    // === 🧠 Mantiene un hilo (thread) por usuario ===
    const threadKey = `thread_${userId || "anonimo"}`;
    if (!global[threadKey]) {
      const newThread = await openai.beta.threads.create();
      global[threadKey] = newThread.id;
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

    // Esperar respuesta del asistente
    let runStatus;
    do {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    } while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed"
    );

    if (runStatus.status === "failed") {
      throw new Error("El asistente no pudo generar respuesta.");
    }

    // Obtener respuesta
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply =
      messages.data[0]?.content?.[0]?.text?.value || "Sin respuesta.";

    // === 🧲 CAPTURA AUTOMÁTICA DE LEADS (HubSpot) ===
    const nameMatch = message.match(
      /(soy|me llamo|nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i
    );
    const phoneMatch = message.match(/\+?\d{7,15}/);
    const emailMatch = message.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i
    );

    if (nameMatch || phoneMatch || emailMatch) {
      console.log("📬 Detectado nuevo lead. Enviando a HubSpot...");

      try {
        const hubspotRes = await fetch(
          "https://api.hubapi.com/crm/v3/objects/contacts",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HUBSPOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: {
                firstname: nameMatch ? nameMatch[2] : "Cliente",
                phone: phoneMatch ? phoneMatch[0] : "",
                email: emailMatch
                  ? emailMatch[0]
                  : `${Date.now()}@temporal.com`,
                lifecyclestage: "lead",
                source: "Chat Alejandro iA Web",
              },
            }),
          }
        );

        const result = await hubspotRes.json();
        console.log("🔎 Respuesta HubSpot:", hubspotRes.status, result);

        if (!hubspotRes.ok) {
          console.error("⚠️ Error al crear contacto en HubSpot:", result);
        } else {
          console.log("✅ Lead enviado correctamente a HubSpot.");
        }

        // === (Opcional) Enviar correo al cliente ===
        /*
        if (emailMatch) {
          await sgMail.send({
            to: emailMatch[0],
            from: "alejandro@tudominio.com",
            subject: "Información sobre el sistema solar Comfort",
            html: `<p>Gracias ${nameMatch ? nameMatch[2] : ""} por tu interés en nuestro sistema de energía solar Comfort 🌞.</p>
                   <p>Un asesor se comunicará contigo pronto.</p>`,
          });
          console.log("📧 Correo enviado correctamente al cliente.");
        }
        */
      } catch (hubError) {
        console.error("❌ Error al enviar lead a HubSpot:", hubError.message);
      }
    }

    // Respuesta al cliente final
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
  console.log(`🌞 Alejandro iA WebChat corriendo en puerto ${PORT}`);
});
