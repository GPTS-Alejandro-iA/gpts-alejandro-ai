import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------------------------------------------------
   1) CONFIGURACIÓN DEL ASSISTANT
--------------------------------------------------------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

/* ---------------------------------------------------------
   2) CLIENTE DE OPENAI
--------------------------------------------------------- */
async function callOpenAI(messages) {
  try {
    const res = await fetch("https://api.openai.com/v1/assistants/" + ASSISTANT_ID + "/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        messages,
        model: "gpt-4.1-mini",
        tool_choice: "auto"
      })
    });

    const data = await res.json();
    console.log("\n🟦 RESPUESTA DE OPENAI:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("❌ Error llamando a OpenAI:", error);
    return { error };
  }
}

/* ---------------------------------------------------------
   3) FUNCIÓN: ENVÍO DE LEAD A HUBSPOT
--------------------------------------------------------- */
async function sendToHubSpot({ name, email, phone, message }) {
  try {
    console.log("\n🟧 Enviando lead a HubSpot…");

    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          email,
          firstname: name || "",
          phone: phone || "",
          message: message || ""
        }
      })
    });

    const result = await response.json();
    console.log("🟩 HubSpot respondió:", result);

    return result;
  } catch (error) {
    console.error("❌ Error enviando a HubSpot:", error);
    return { error };
  }
}

/* ---------------------------------------------------------
   4) FUNCIÓN: ENVÍO DE EMAIL VIA GMAIL
--------------------------------------------------------- */
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({ to, subject, text }) {
  try {
    console.log("\n🟧 Enviando email a:", to);

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      text
    });

    console.log("🟩 Email enviado:", info);
    return info;
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return { error };
  }
}

/* ---------------------------------------------------------
   5) RUTA PRINCIPAL DEL CHAT
--------------------------------------------------------- */
app.post("/chat", async (req, res) => {
  const { userMessage, thread } = req.body;

  console.log("\n🟨 MENSAJE RECIBIDO DEL CLIENTE:", userMessage);

  const aiResponse = await callOpenAI([
    { role: "user", content: userMessage }
  ]);

  if (!aiResponse || aiResponse.error) {
    return res.json({
      reply: "Hubo un error hablando con Alejandro iA."
    });
  }

  const toolCall = aiResponse?.messages?.[0]?.tool_calls?.[0];
  let aiText = aiResponse?.messages?.[0]?.content || "";

  if (toolCall) {
    const toolName = toolCall.name;
    const args = toolCall.arguments;

    console.log("\n🟦 TOOL REQUEST:", toolName, args);

    if (toolName === "send_lead") {
      await sendToHubSpot(args);
      aiText = "Perfecto, ya registré tus datos.";
    }

    if (toolName === "send_email") {
      await sendEmail(args);
      aiText = "Acabo de enviarte un correo con toda la información.";
    }
  }

  return res.json({ reply: aiText });
});

/* ---------------------------------------------------------
   6) INTERFAZ FRONTEND /chat-ui
--------------------------------------------------------- */
app.get("/chat-ui", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Alejandro iA</title>
    <style>
      body { font-family: Arial; padding: 30px; }
      #chat { width: 100%; max-width: 600px; margin: auto; }
      textarea { width: 100%; height: 100px; }
      .msg { margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <h2>Chat con Alejandro iA</h2>
    <div id="chat"></div>

    <textarea id="input"></textarea>
    <button onclick="send()">Enviar</button>

    <script>
      async function send() {
        const text = document.getElementById("input").value;
        addMsg("Tú: " + text);

        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: text })
        });

        const data = await res.json();
        addMsg("Alejandro: " + data.reply);
      }

      function addMsg(msg) {
        const div = document.getElementById("chat");
        div.innerHTML += "<div class='msg'>" + msg + "</div>";
      }
    </script>
  </body>
  </html>
  `);
});

/* ---------------------------------------------------------
   6.5) RUTA RAÍZ /
--------------------------------------------------------- */
app.get("/", (req, res) => {
  res.redirect("/chat-ui");
});

/* ---------------------------------------------------------
   7) SERVIDOR ONLINE
--------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Servidor corriendo en puerto", PORT));
