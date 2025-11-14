import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

/* ---------------------------------------------------------
   CLIENTE DE OPENAI (Threads + Runs)
--------------------------------------------------------- */
async function callOpenAI(messages, threadId = null) {
  try {
    const thread = threadId
      ? { id: threadId }
      : await fetch("https://api.openai.com/v1/threads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`
          }
        }).then(res => res.json());

    await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        role: "user",
        content: messages[0].content
      })
    });

    const runRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID
      })
    });

    const run = await runRes.json();

    let runStatus = run.status;
    while (runStatus !== "completed" && runStatus !== "failed") {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`
        }
      });
      const statusData = await statusRes.json();
      runStatus = statusData.status;
    }

    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      }
    });

    const messagesData = await messagesRes.json();
    const lastMessage = messagesData.data[0];
    const text = lastMessage.content[0].text.value;

    return { reply: text, threadId: thread.id };
  } catch (error) {
    console.error("❌ Error llamando a OpenAI:", error);
    return { error };
  }
}

/* ---------------------------------------------------------
   ENVÍO DE LEAD A HUBSPOT
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
   ENVÍO DE EMAIL VIA GMAIL
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
   RUTA PRINCIPAL DEL CHAT
--------------------------------------------------------- */
app.post("/chat", async (req, res) => {
  const { userMessage, threadId } = req.body;

  console.log("\n🟨 MENSAJE RECIBIDO DEL CLIENTE:", userMessage);

  const aiResponse = await callOpenAI([{ role: "user", content: userMessage }], threadId);

  if (!aiResponse || aiResponse.error) {
    return res.json({
      reply: "Hubo un error hablando con Alejandro iA."
    });
  }

  return res.json({
    reply: aiResponse.reply,
    threadId: aiResponse.threadId
  });
});

/* ---------------------------------------------------------
   INTERFAZ FRONTEND /chat-ui
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
      let threadId = null;

      async function send() {
        const text = document.getElementById("input").value;
        addMsg("Tú: " + text);

        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: text, threadId })
        });

        const data = await res.json();
        threadId = data.threadId;
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
   RUTA RAÍZ /
--------------------------------------------------------- */
app.get("/", (req, res) => {
  res.redirect("/chat-ui");
});

/* ---------------------------------------------------------
   SERVIDOR ONLINE
--------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Servidor corriendo en puerto", PORT));
