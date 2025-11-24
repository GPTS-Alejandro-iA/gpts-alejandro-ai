import { createServer } from "https://jsr.io/@oak/oak/15.4.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = createServer();

// === CONFIGURACIÓN DE ENTORNO ===
const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN");
const GMAIL_USER = Deno.env.get("GMAIL_USER") || "gpts.citas@gmail.com";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

// Nodemailer (envío real desde Gmail)
import nodemailer from "https://esm.sh/nodemailer@6.9.14";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// === TOOLS (exactamente como tú los definiste) ===
const tools = [
  {
    name: "send_lead",
    description: "Envía un lead a HubSpot CRM",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre completo del cliente" },
        phone: { type: "string", description: "Número de teléfono del cliente" },
        email: { type: "string", description: "Correo electrónico del cliente" },
        address: { type: "string", description: "Dirección física del cliente" },
        preferred_time: { type: "string", description: "Horario preferido para contacto" },
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
        to: { type: "string", description: "Correo electrónico del cliente" },
        subject: { type: "string", description: "Asunto del correo" },
        text: { type: "string", description: "Cuerpo del correo con la propuesta" },
      },
      required: ["to", "subject", "text"],
    },
  },
];

// === FUNCIÓN: ENVIAR LEAD A HUBSPOT (real) ===
async function sendLeadToHubSpot({ name, phone, email = "", address = "", preferred_time = "" }) {
  if (!HUBSPOT_TOKEN) return console.log("Falta HUBSPOT_TOKEN");

  const [firstname = "", lastname = ""] = name.split(" ");

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
        phone,
        email,
        address,
        preferred_contact_time: preferred_time,
        lead_source: "Chat Alejandro AI",
        lifecyclestage: "lead",
      },
    }),
  });
}

// === FUNCIÓN: ENVIAR COTIZACIÓN POR EMAIL (real) ===
async function sendProposalEmail({ to, subject, text }) {
  const mailOptions = {
    from: `"Alejandro - Green Power Tech Store" <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html: text.replace(/\n/g, "<br>"),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email enviado a ${to}`);
  } catch (error) {
    console.error("Error enviando email:", error);
  }
}

// === RUTA PRINCIPAL DEL CHAT ===
app.post("/chat", async (ctx) => {
  const { messages, tool_results } = await ctx.request.body({ type: "json" }).value;

  // Procesar tool results (si el modelo llamó a alguna función)
  for (const result of tool_results || []) {
    if (result.name === "send_lead") {
      await sendLeadToHubSpot(JSON.parse(result.arguments));
    }
    if (result.name === "send_email") {
      await sendProposalEmail(JSON.parse(result.arguments));
    }
  }

  // Aquí va tu lógica de respuesta del modelo (OpenAI, Grok, etc.)
  // Este ejemplo solo responde un mensaje de confirmación
  const userMessage = messages[messages.length - 1].content;

  ctx.response.body = {
    response: `¡Gracias! Ya recibí tu información.\n\n` +
              `Lead enviado a HubSpot y cotización enviada a tu correo.\n` +
              `En breve el Sr. Oxor Alejandro Vázquez te contactará al 787-699-2140.\n\n` +
              `¡Que tengas un excelente día! ☀️`,
    tools: tools,
  };
});

// === INICIAR SERVIDOR ===
serve(app.listen({ port: 8000 }));
console.log("Alejandro AI corriendo en https://tu-render-url.onrender.com");
