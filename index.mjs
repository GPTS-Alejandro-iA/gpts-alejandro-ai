import express from "express";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "10mb" }));

// === CONFIG ===
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER || "gpts.citas@gmail.com";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

// === TOOLS (exactamente como tú los definiste) ===
const tools = [
  {
    name: "send_lead",
    description: "Envía un lead a HubSpot CRM",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        preferred_time: { type: "string" },
      },
      required: ["name", "phone"],
    },
  },
  {
    name: "send_email",
    description: "Envía una propuesta formal de Green Power Tech Store al correo del cliente.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        text: { type: "string" },
      },
      required: ["to", "subject", "text"],
    },
  },
];

// === ENVIAR LEAD A HUBSPOT ===
async function sendLeadToHubSpot(data) {
  if (!HUBSPOT_TOKEN) return console.log("Falta HUBSPOT_TOKEN");
  const [firstname, ...rest] = data.name.split(" ");
  const lastname = rest.join(" ") || "";

  await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        firstname,
        lastname,
        phone: data.phone,
        email: data.email || "",
        address: data.address || "",
        preferred_contact_time: data.preferred_time || "",
        lead_source: "Chat Alejandro AI",
      },
    }),
  });
}

// === ENVIAR EMAIL ===
async function sendProposalEmail({ to, subject, text }) {
  await transporter.sendMail({
    from: `"Alejandro - Green Power Tech Store" <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html: text.replace(/\n/g, "<br>"),
  });
  console.log(`Cotización enviada a ${to}`);
}

// === RUTA CHAT ===
app.post("/chat", async (req, res) => {
  const { tool_calls } = req.body;

  if (tool_calls) {
    for (const call of tool_calls) {
      const args = JSON.parse(call.arguments || "{}");
      if (call.name === "send_lead") await sendLeadToHubSpot(args);
      if (call.name === "send_email") await sendProposalEmail(args);
    }
  }

  res.json({
    response: "¡Perfecto! Lead enviado a HubSpot y cotización enviada al correo.\n\nEl Sr. Oxor te contactará pronto al 787-699-2140.\n\n¡Excelente día! ☀️",
    tools,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alejandro AI corriendo en puerto ${PORT}`));
