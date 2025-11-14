// index.mjs
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

// === CONFIG ===
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const ASSISTANT_ID = process.env.ASSISTANT_ID || "asst_fUNT2sPlWS7LYmNqrU9uHKoU";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // email que recibe notificaciones (ej: ventas@greenpowertech.store)
const GMAIL_USER = process.env.GMAIL_USER; // tu correo gmail
const GMAIL_PASS = process.env.GMAIL_PASS; // app password de 16 chars

if (!OPENAI_API_KEY) {
  console.error("Falta OPENAI_API_KEY en variables de entorno.");
  process.exit(1);
}
if (!HUBSPOT_TOKEN) {
  console.error("Falta HUBSPOT_ACCESS_TOKEN en variables de entorno.");
  process.exit(1);
}
if (!ADMIN_EMAIL || !GMAIL_USER || !GMAIL_PASS) {
  console.warn("ADMIN_EMAIL o credenciales de Gmail faltantes. Emails no serán enviados hasta configurarlas.");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Nodemailer transporter (Gmail App Password)
let transporter = null;
if (GMAIL_USER && GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });
}

// === In-memory thread + meta store ===
// threadIdByUser[userId] = threadId
// metaByThread[threadId] = { formCompleted: bool, collected: { firstname, lastname, phone, email }, createdAt }
const threadIdByUser = {};
const metaByThread = {};

// Helper: create or get thread for user
async function ensureThreadForUser(userId = "default") {
  if (threadIdByUser[userId]) return threadIdByUser[userId];
  const thread = await openai.beta.threads.create();
  threadIdByUser[userId] = thread.id;
  metaByThread[thread.id] = {
    formCompleted: false,
    collected: {},
    createdAt: Date.now(),
  };
  console.log(`🧵 Nuevo hilo creado para usuario ${userId} (${thread.id})`);
  return thread.id;
}

// Helper: simple entity extraction (name/phone/email) from text
function extractContactInfo(text = "") {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  const phoneMatch = text.match(/\+?\d{7,15}/);
  // name heuristics: "me llamo X Y" or "soy X Y" or "mi nombre es X Y"
  const nameMatch = text.match(/(?:me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ-]+)??)/i);
  let firstname, lastname;
  if (nameMatch) {
    const parts = nameMatch[1].trim().split(/\s+/);
    firstname = parts.shift() || "";
    lastname = parts.join(" ") || "";
  }
  return {
    email: emailMatch ? emailMatch[0] : undefined,
    phone: phoneMatch ? phoneMatch[0] : undefined,
    firstname,
    lastname,
  };
}

// Helper: send lead to HubSpot (creates contact)
// Avoid custom props to prevent "PROPERTY_DOESNT_EXIST" errors
async function sendLeadToHubSpot({ firstname, lastname, email, phone }) {
  const url = "https://api.hubapi.com/crm/v3/objects/contacts";
  const body = {
    properties: {
      firstname: firstname || "Cliente",
      lastname: lastname || "",
      email: email || `${Date.now()}@temporal.com`,
      phone: phone || "",
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  return { status: resp.ok ? "ok" : "error", body: data };
}

// Helper: send notification email via nodemailer
async function sendNotificationEmail(lead) {
  if (!transporter) {
    console.warn("Transporter nodemailer no configurado.");
    return;
  }
  const html = `
    <h3>Nuevo lead desde Alejandro iA</h3>
    <p><strong>Nombre:</strong> ${lead.firstname || ""} ${lead.lastname || ""}</p>
    <p><strong>Teléfono:</strong> ${lead.phone || ""}</p>
    <p><strong>Email:</strong> ${lead.email || ""}</p>
    <p><strong>Mensaje / Origen:</strong> ${lead.sourceText || ""}</p>
    <p>Hora: ${new Date().toLocaleString()}</p>
  `;
  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: ADMIN_EMAIL,
      subject: "🔔 Nuevo lead - Alejandro iA",
      html,
    });
    console.log("✅ Email de notificación enviado a", ADMIN_EMAIL);
  } catch (err) {
    console.error("❌ Error enviando email:", err);
  }
}

// === ROUTES ===
app.get("/", (req, res) => {
  res.send("✅ Alejandro iA WebChat activo y conectado.");
});

// /chat endpoint: receives { message, userId } from frontend
app.post("/chat", async (req, res) => {
  try {
    const { message, userId = "default" } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensaje vacío." });
    }

    // Ensure thread exists for this user
    const threadId = await ensureThreadForUser(userId);

    // If meta.formCompleted is false, and this is the first time, assistant should ask for required fields.
    const meta = metaByThread[threadId] || { formCompleted: false, collected: {} };

    // Send user message into thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Run assistant using your assistant id
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Wait until run completed (simple polling)
    let runStatus;
    const start = Date.now();
    do {
      await new Promise((r) => setTimeout(r, 800));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      // safety timeout 20s
      if (Date.now() - start > 20000 && runStatus.status !== "completed") {
        break;
      }
    } while (runStatus.status !== "completed" && runStatus.status !== "failed");

    if (runStatus.status === "failed") {
      console.error("Assistant run failed:", runStatus);
      return res.status(500).json({ error: "El asistente falló al generar respuesta." });
    }

    // Get messages from thread and pick assistant latest reply
    const messagesList = await openai.beta.threads.messages.list(threadId);
    // Find last assistant message
    const assistantMsg = messagesList.data.find((m) => m.role === "assistant") || messagesList.data[0];
    // The structure may vary; attempt to extract text
    const replyText =
      assistantMsg?.content?.[0]?.text?.value ||
      assistantMsg?.content?.[0]?.parts?.[0] ||
      assistantMsg?.content?.[0]?.text ||
      "Disculpa, no pude generar una respuesta en este momento.";

    // === Lead detection & form flow handling ===
    const { email, phone, firstname, lastname } = extractContactInfo(message);
    // Merge into collected data if present
    if (!meta.collected) meta.collected = {};
    if (firstname && !meta.collected.firstname) meta.collected.firstname = firstname;
    if (lastname && !meta.collected.lastname) meta.collected.lastname = lastname;
    if (phone && !meta.collected.phone) meta.collected.phone = phone;
    if (email && !meta.collected.email) meta.collected.email = email;

    // Check if required fields present
    const hasRequired = meta.collected.firstname && meta.collected.lastname && (meta.collected.phone || meta.collected.email);

    if (!meta.formCompleted && hasRequired) {
      // mark complete, send to HubSpot, and notify by email
      meta.formCompleted = true;
      metaByThread[threadId] = meta;

      // Send to HubSpot
      const leadPayload = {
        firstname: meta.collected.firstname,
        lastname: meta.collected.lastname,
        email: meta.collected.email,
        phone: meta.collected.phone,
        sourceText: message.slice(0, 800),
      };

      try {
        const hubResp = await sendLeadToHubSpot(leadPayload);
        if (hubResp.status === "ok") {
          console.log("✅ Lead enviado a HubSpot:", hubResp.body);
        } else {
          console.log("✅ Lead enviado a HubSpot: ", hubResp);
        }
      } catch (err) {
        console.error("❌ Error enviando lead a HubSpot:", err);
      }

      // Send notification email to admin
      try {
        await sendNotificationEmail(leadPayload);
      } catch (err) {
        console.error("❌ Error enviando email:", err);
      }

      // Add a short confirmation sentence to the assistant reply (but do not replace assistant answer)
      const confirmation = "\n\n✅ Gracias — ya recibí tu información. Ahora continuaré con la orientación.";
      return res.json({ reply: replyText + confirmation });
    }

    // If form not complete and assistant did not ask, optionally prompt the form requirement
    if (!meta.formCompleted) {
      // We require at least: Nombre, Apellidos, Teléfono (o email)
      // If assistant didn't already ask for the form (we can't reliably know), we'll proactively remind once every thread creation.
      // Use a flag in meta: formPromptSent
      if (!meta.formPromptSent) {
        meta.formPromptSent = true;
        metaByThread[threadId] = meta;
        const formRequest =
          "👋 Para continuar con la orientación y/o cotización, por favor compárteme: Nombre, Apellidos y Teléfono (o email). Con eso puedo preparar tu cotización personalizada.";
        // Return assistant reply + form request (assistant may already have said greetings; we append)
        return res.json({ reply: `${replyText}\n\n${formRequest}` });
      }
    }

    // Default: return assistant reply
    return res.json({ reply: replyText });
  } catch (error) {
    console.error("❌ Error en /chat:", error);
    // Avoid leaking internal stack traces to client
    return res.status(500).json({ error: "Error interno en el servidor." });
  }
});

// === START SERVER ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌞 Alejandro iA WebChat corriendo en puerto ${PORT}`);
});
