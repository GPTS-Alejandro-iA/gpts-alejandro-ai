import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------
// CONFIG: OPENAI
// -----------------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -----------------------------
// CONFIG: SMTP (Gmail)
// -----------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// -----------------------------
// CONFIG: HUBSPOT
// -----------------------------
const HUBSPOT_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

async function sendToHubSpot(name, email, phone, message) {
  try {
    const response = await fetch(HUBSPOT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          firstname: name || "Cliente",
          email: email || "",
          phone: phone || "",
          message: message || "",
        },
      }),
    });

    const data = await response.json();
    console.log("HubSpot Response:", data);

    if (!response.ok) {
      console.error("HubSpot Error:", data);
      return false;
    }

    return true;
  } catch (err) {
    console.error("HubSpot Exception:", err);
    return false;
  }
}

// -----------------------------
// ENVIAR CORREO AL CLIENTE
// -----------------------------
async function sendEmailToClient({ to, subject, text }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
    });

    console.log("Correo enviado:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error enviando correo:", error);
    return false;
  }
}

// -----------------------------
// RUTA PRINCIPAL DEL CHAT
// -----------------------------
app.post("/chat", async (req, res) => {
  const { threadId, message } = req.body;

  try {
    let thread = threadId
      ? { id: threadId }
      : await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    const messages = await client.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0].content[0].text.value;

    console.log("Assistant:", lastMessage);

    if (run.required_action) {
      const action = run.required_action.submit_tool_outputs.tool_calls[0];

      if (action.function.name === "send_lead") {
        const payload = JSON.parse(action.function.arguments);
        await sendToHubSpot(
          payload.name,
          payload.email,
          payload.phone,
          payload.message
        );

        await client.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
          tool_outputs: [
            {
              tool_call_id: action.id,
              output: JSON.stringify({ status: "ok" }),
            },
          ],
        });
      }

      if (action.function.name === "send_email") {
        const payload = JSON.parse(action.function.arguments);
        await sendEmailToClient({
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
        });

        await client.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
          tool_outputs: [
            {
              tool_call_id: action.id,
              output: JSON.stringify({ status: "email_sent" }),
            },
          ],
        });
      }
    }

    res.json({
      reply: lastMessage,
      threadId: thread.id,
    });
  } catch (error) {
    console.error("Error /chat:", error);
    res.json({
      reply: "Lo siento, tuve un problema al procesar tu mensaje.",
      threadId: null,
    });
  }
});

// -----------------------------
// RUTA DE PRUEBA
// -----------------------------
app.get("/", (req, res) => {
  res.send("Alejandro iA está activo.");
});

// -----------------------------
// RUTA PARA INTERFAZ WEB
// -----------------------------
app.get("/chat-ui", (req, res) => {
  res.sendFile(path.join(__dirname, "chat.html"));
});

// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Servidor Alejandro iA corriendo en puerto ${PORT}`)
);
