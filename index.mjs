import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID; // Tu Assistant de Alejandro iA
const threads = new Map(); // Guardará threads por cliente (por ejemplo por phone o sessionId)

app.post("/chat", async (req, res) => {
  try {
    const { message, phone, name, email, bestTime, address } = req.body;
    if (!phone) {
      return res.json({
        reply: "⚠️ No se proporcionó teléfono. Necesitamos al menos nombre y teléfono para continuar.",
      });
    }

    let thread = threads.get(phone);
    if (!thread) {
      // Crear thread nuevo por cliente
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `
📑 PROMPT MAESTRO — Alejandro iA | Green Power Tech Store
Actúa como Alejandro iA, asesor solar experto. Habla español neutral y profesional. 
Sigue exactamente estas reglas: 
1️⃣ Pregunta primero qué tipo de sistema interesa (solar o backup). 
2️⃣ Luego solicita los datos de contacto obligatorios: nombre, teléfono. 
3️⃣ No repitas la solicitud de datos si ya fueron dados. 
4️⃣ Usa respuestas cortas, claras y persuasivas, basadas en el Prompt Maestro completo. 
5️⃣ Una vez tengas datos mínimos, continúa orientación y ofrece cotización si aplica. 
6️⃣ Extrae automáticamente los datos y llama a send_lead({name, phone, bestTime, address}). 
7️⃣ Cuando corresponda enviar cotización, prepara send_email() según la instrucción técnica.
`
          },
          { role: "user", content: message },
        ],
      });

      thread = response.choices[0].message;
      threads.set(phone, thread);
      return res.json({ reply: thread.content });
    }

    // Continuar thread existente
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Este es un thread ya iniciado con un cliente." },
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.json({ reply: "❌ Error procesando el mensaje." });
  }
});

app.listen(process.env.PORT || 10000, () => {
  console.log("Servidor corriendo en puerto 10000");
});
