import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { send_lead, send_email } from "./functions.js";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const GPT_MODEL = process.env.GPT_MODEL || "gpt-4.1";

// ---------------------------------------------------------
// ESTADOS DE CONVERSACIÓN (FSM)
// ---------------------------------------------------------

const sessions = new Map(); // sessionID → state + data

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      state: "inicio",
      name: null,
      phone: null,
      interest: null,
      email: null
    });
  }
  return sessions.get(sessionId);
}

// ---------------------------------------------------------
// MATCHERS CORREGIDOS (MUY IMPORTANTES)
// ---------------------------------------------------------

const phoneRegex =
  /(\+1\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;

const nameRegex =
  /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)\b/;

// ---------------------------------------------------------
// PROMPT MAESTRO
// ---------------------------------------------------------

const promptMaestro = {
  role: "system",
  content: `
Eres Alejandro iA, asistente solar de Green Power Tech Store en Puerto Rico.
Hablas con empatía, claridad y estilo profesional.
Siempre sigues estrictamente el estado de conversación definido por el backend.
Nunca pides los datos dos veces si ya existen.`
};

// ---------------------------------------------------------
// SERVIR EL FRONTEND
// ---------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "public") });
});

// ---------------------------------------------------------
// ENDPOINT PRINCIPAL DEL CHAT
// ---------------------------------------------------------

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  // Si no viene sessionId → Generar uno basado en IP
  const sid = sessionId || req.ip;
  const session = getSession(sid);

  let reply = "⚠️ Hubo un error inesperado.";

  try {
    // --------------------------
    //  FSM — MANEJO DE ESTADOS
    // --------------------------

    if (session.state === "inicio") {
      session.state = "pidiendo_datos";
      reply = "¡Hola! Soy **Alejandro Ai** 🤖☀️. Antes de orientarte, ¿me compartes tu nombre y número de teléfono?";
    }

    else if (session.state === "pidiendo_datos") {
      const phoneMatch = message.match(phoneRegex);
      const nameMatch = message.match(nameRegex);

      if (nameMatch) session.name = nameMatch[1];
      if (phoneMatch) session.phone = phoneMatch[0];

      // Si faltan datos, pedir solo lo que falta
      if (!session.name || !session.phone) {
        let missing = [];
        if (!session.name) missing.push("tu nombre");
        if (!session.phone) missing.push("tu número");

        reply = `Perfecto 😊. Solo necesito **${missing.join(" y ")}** para continuar.`;
      } else {
        // Ya hay todo → enviar lead
        await send_lead({
          name: session.name,
          phone: session.phone,
          interest: session.interest || "No especificado"
        });

        session.state = "esperando_interes";

        reply = `¡Excelente, ${session.name}! 🙌  
Ya tengo tus datos. Ahora cuéntame, ¿qué sistema deseas conocer?

1. 🔆 Energía Solar  
2. ⚡ Backup para apartamento / oficina  
3. 🤝 Ayuda para evaluar tu factura`
      }
    }

    else if (session.state === "esperando_interes") {
      if (/1|solar|placas/i.test(message)) {
        session.interest = "solar";
        session.state = "asesorando";
        reply = "Perfecto 🌞. Cuéntame: ¿Quieres energía solar **fuera de la red**, o un sistema **híbrido con baterías**?";
      }
      else if (/2|backup/i.test(message)) {
        session.interest = "backup";
        session.state = "asesorando";
        reply = "¡Excelente! ⚡ Los backups son perfectos para apartamentos. ¿Cuántos equipos deseas mantener durante un apagón?";
      }
      else {
        reply = "Para ayudarte mejor, dime: **1 solar**, **2 backup**, o **3 ayuda con factura**.";
      }
    }

    else if (session.state === "asesorando") {
      // Aquí entra la IA para respuesta profesional
      const completion = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          promptMaestro,
          { role: "user", content: message },
          { role: "assistant", content: "Responde como Alejandro iA." }
        ],
        temperature: 0.7
      });

      reply = completion.choices[0].message.content;
    }

  } catch (err) {
    console.error("❌ Error en /chat:", err);
    reply = "⚠️ Ocurrió un error mientras procesaba tu solicitud.";
  }

  res.json({ reply });
});

// ---------------------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------------------

app.listen(PORT, () => {
  console.log(`🚀 Alejandro Ai activo en el puerto ${PORT}`);
});
