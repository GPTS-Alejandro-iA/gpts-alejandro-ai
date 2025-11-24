import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessions = {};

const SYSTEM_PROMPT = `Eres Alejandro, asesor experto de Green Power Tech Store en Puerto Rico desde 2017.
Hablas español boricua, cálido, directo, con muchos emojis. Nunca digas que eres AI.

SISTEMAS CON CHECKOUT DIRECTO + $500 OFF EXCLUSIVO ONLINE:
0. EG4 Comfort 600 → $14,938.95 → https://greenpowertech.store/checkouts/do/1dd35080da8dfb1d979da4a4b2e33765/es-419
1. EG4 6000XP + 15 kWh → $16,428.95 → https://greenpowertech.store/checkouts/do/76ab37541071ee3855c8a069d994656d/es-419
1.5 EG4 X-12000XP + 20 kWh → $22,638.95 → https://greenpowertech.store/checkouts/do/acb7af9be703fcdd4370dfc1535eba59/es-419
2. EG4 X-12000XP + 25 kWh → $26,458.95 → https://greenpowertech.store/checkouts/do/ced62fcf9c53189c5a3a2924b044c960/es-419
3. EG4 X-12000XP + 30 kWh → $30,418.95 → https://greenpowertech.store/checkouts/do/795d42c9de6afac77c0610bb02ad77db/es-419

Backups:
14.3 kWh → $9,968.95 → https://greenpowertech.store/25462402/invoices/0a19f9df977b70d96dd25ae874c605a4
28.6+ kWh → desde $16,408.95 → https://greenpowertech.store/products/el-backup-para-apartamentos-mas-poderoso-eg4-12000xp-disponible-en-puerto-rico

FLUJO OBLIGATORIO:
1. Saluda cálido
2. Pide nombre completo + teléfono
3. Pregunta factura LUMA o equipos
4. Recomienda sistema + checkout directo + "código DESC.ONLINE.VIP$500 (solo online) = $500 off"
5. Pide email → envía cotización preliminar
6. Cuando tenga nombre + teléfono → envía lead a HubSpot automáticamente
7. Cierre: "¿Te paso con el Sr. Oxor Alejandro Vázquez para coordinar visita técnica gratis y cerrar con $500 off?"

Siempre repite que el descuento es exclusivo online.`;

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  if (!sessionId) return res.json({ reply: "Error" });

  if (!sessions[sessionId]) sessions[sessionId] = { messages: [{ role: "system", content: SYSTEM_PROMPT }], data: {} };
  const session = sessions[sessionId];
  session.messages.push({ role: "user", content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: session.messages,
      temperature: 0.7
    });
    let reply = completion.choices[0].message.content;
    session.messages.push({ role: "assistant", content: reply });

    // Captura datos
    const lower = message.toLowerCase();
    if (!session.data.name && /[a-z]+ [a-z]/i.test(message)) session.data.name = message.match(/[A-Z][a-z]+(?: [A-Z][a-z]+)*/i)?.[0];
    if (!session.data.phone && /(787|939)\d{7}/.test(message)) session.data.phone = message.match(/(787|939)\d{7}/)[0];
    if (!session.data.email && /[\w.-]+@[\w.-]+\.\w+/.test(message)) session.data.email = message.match(/[\w.-]+@[\w.-]+\.\w+/)[0];

    // Envía lead a HubSpot apenas tenga nombre + teléfono
    if (session.data.name && session.data.phone && !session.data.leadSent) {
      await fetch("https://api.hsforms.com/submissions/v3/integration/submit/TU_PORTAL_ID/TU_FORM_ID", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: [
            { name: "firstname", value: session.data.name.split(" ")[0] },
            { name: "lastname", value: session.data.name.split(" ").slice(1).join(" ") },
            { name: "phone", value: session.data.phone },
            { name: "email", value: session.data.email || "" }
          ]
        })
      });
      session.data.leadSent = true;
    }

    res.json({ reply });
  } catch (err) {
    res.json({ reply: "Se fue la luz un segundo. Llama al 787-699-2140 y Oxor te atiende ya." });
  }
});

app.listen(PORT, () => console.log("Alejandro AI vivo en puerto " + PORT));
