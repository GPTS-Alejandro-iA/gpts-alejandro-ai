import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// Funciones externas
import { send_lead, send_email, generatePDFQuote } from "./functions.js";

dotenv.config();

// ----------------------------------------------
// VARIABLES BASE
// ----------------------------------------------
const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GPT_MODEL = process.env.GPT_MODEL || "gpt-4.1";

// Prompt maestro del assistant
const promptMaestro = {
  role: "system",
  content: `
Eres Alejandro iA, el asistente solar emocional de Green Power Tech Store.
Tu misión es guiar al cliente con empatía, claridad y profesionalismo.
Hablas con calidez caribeña, usas emojis, y siempre das pasos concretos.

Nunca repites saludos.
Nunca pides datos dos veces.
Nunca devuelves respuestas genéricas.

Tu flujo ideal:
1. Dar bienvenida
2. Pedir nombre
3. Pedir teléfono
4. Orientar según lo que desea el cliente
5. Ofrecer cotización PDF por email si aplica
6. Enviar correo usando send_email()
7. Siempre cerrar con una pregunta que invite acción
`
};

// ----------------------------------------------
// DIRNAME
// ----------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------
// MIDDLEWARE
// ----------------------------------------------
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------
// FRONTEND
// ----------------------------------------------
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "public") });
});

// ----------------------------------------------
// SISTEMA DE ESTADOS PARA ALEJANDRO IA
// ----------------------------------------------
const sessions = {};

app.post("/chat", async (req, res) => {
  const sessionId = req.headers["x-session-id"] || "default";
  const message = req.body.message || "";

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      state: "inicio",
      name: null,
      phone: null,
      email: null,
      history: [],
    };
  }

  const session = sessions[sessionId];
  let reply = "";

  // ----------------------------------------------
  // 1. INICIO
  // ----------------------------------------------
  if (session.state === "inicio") {
    session.state = "pedir_nombre";
    reply = "👋 ¡Hola! Soy **Alejandro iA** de Green Power Tech Store. ¿Cuál es tu nombre?";
    session.history.push({ role: "assistant", content: reply });
    return res.json({ reply });
  }

  // ----------------------------------------------
  // 2. PEDIR NOMBRE
  // ----------------------------------------------
  if (session.state === "pedir_nombre") {
    session.name = message.trim();
    session.state = "pedir_telefono";

    reply = `¡Qué placer conocerte, **${session.name}**! 😊  
Antes de avanzar, ¿me compartes tu número de teléfono para preparar tu orientación?`;

    session.history.push({ role: "assistant", content: reply });
    return res.json({ reply });
  }

  // ----------------------------------------------
  // 3. PEDIR TELÉFONO
  // ----------------------------------------------
  if (session.state === "pedir_telefono") {
    session.phone = message.trim();
    session.state = "atencion";

    // Guardar lead en HubSpot
    await send_lead({ name: session.name, phone: session.phone });

    reply = `Perfecto, **${session.name}**. Ya anoté tu número.  
Cuéntame: ¿qué deseas conocer hoy?

1️⃣ Energía Solar  
2️⃣ Backup de Baterías  
3️⃣ Cotización por email  
4️⃣ Sistemas para negocio`;

    session.history.push({ role: "assistant", content: reply });
    return res.json({ reply });
  }

  // ----------------------------------------------
  // 4. DETECTOR UNIVERSAL DE COTIZACIÓN POR EMAIL
  // ----------------------------------------------
  const wantsEmailQuote =
    message.toLowerCase().includes("cotiz") ||
    message.toLowerCase().includes("correo") ||
    message.toLowerCase().includes("email") ||
    message.toLowerCase().includes("pdf");

  if (wantsEmailQuote) {
    session.state = "preguntar_email_cotizacion";

    reply =
      "¡Perfecto! ¿A qué e-mail deseas que te envíe tu cotización en **PDF**?";
    session.history.push({ role: "assistant", content: reply });
    return res.json({ reply });
  }

  // ----------------------------------------------
  // 5. PEDIR EMAIL PARA COTIZACIÓN
  // ----------------------------------------------
  if (session.state === "preguntar_email_cotizacion") {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const emailFound = message.match(emailRegex);

    if (!emailFound) {
      reply = "Necesito un correo válido para poder enviarte la cotización. ¿Me lo confirmas?";
      session.history.push({ role: "assistant", content: reply });
      return res.json({ reply });
    }

    session.email = emailFound[0];
    session.state = "enviar_cotizacion_email";

    reply = `Perfecto. Enviando tu cotización a **${session.email}** 📩`;
    session.history.push({ role: "assistant", content: reply });
    return res.json({ reply });
  }

  // ----------------------------------------------
  // 6. ENVIAR COTIZACIÓN PDF
  // ----------------------------------------------
  if (session.state === "enviar_cotizacion_email") {
    try {
      // 🔥 Generar PDF dinámico
      const pdfPath = await generatePDFQuote({
        name: session.name,
        phone: session.phone,
      });

      // 🔥 Enviar correo con PDF adjunto
      await send_email({
        to: session.email,
        subject: "Tu cotización solar — Green Power Tech Store",
        text: "Adjunto encontrarás tu cotización personalizada. Si deseas agregar baterías o aumentar capacidad, solo dímelo.",
        attachment: pdfPath,
      });

      reply = `¡Listo! Tu cotización fue enviada a **${session.email}** en formato PDF 📄✨  
¿Deseas explorar opciones solares o comparar sistemas?`;

    } catch (err) {
      console.error("❌ Error enviando PDF:", err);
      reply = "Hubo un problema enviando la cotización. ¿Deseas intentar nuevamente?";
    }

    session.state = "atencion";
    session.history.push({ role: "assistant", content: reply });
    return res.json({ reply });
  }

  // ----------------------------------------------
  // 7. ESTADO PRINCIPAL: ATENCIÓN NORMAL
  // ----------------------------------------------
  if (session.state === "atencion") {
    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        promptMaestro,
        ...session.history,
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    reply = completion.choices[0].message.content;

    session.history.push({ role: "user", content: message });
    session.history.push({ role: "assistant", content: reply });

    return res.json({ reply });
  }
});

// ----------------------------------------------
// INICIAR SERVIDOR
// ----------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Alejandro iA activo en el puerto ${PORT}`);
});
