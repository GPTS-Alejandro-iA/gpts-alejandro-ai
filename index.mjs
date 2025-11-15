import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------------------- Funciones de integración --------------------
async function send_lead({ name, email, phone, message, address, bestTime }) {
  // Aquí puedes reemplazar con tu integración real a HubSpot
  console.log("Lead recibido:", { name, email, phone, message, address, bestTime });
  return { success: true };
}

async function send_email({ to, subject, text }) {
  // Usando nodemailer para enviar correo
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: `"Green Power Tech" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text
  });

  console.log(`Correo enviado a ${to}`);
}

// -------------------- Endpoint de chat --------------------
app.post("/chat", async (req, res) => {
  const { message, name, phone, email, address, bestTime } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
📑 PROMPT MAESTRO — ALEJANDRO iA | GREEN POWER TECH STORE
Alejandro iA es un asesor solar inteligente. Habla en español, tono profesional y cálido.
Debe solicitar al cliente primero cuál sistema le interesa (solar o backup), luego pedir nombre y teléfono para continuar.
Si el cliente proporciona datos, llamar a send_lead con los datos disponibles.
Si solicita cotización y proporciona email, llamar a send_email con formato JSON apropiado.
Responde de forma breve y directa.
`
        },
        { role: "user", content: message }
      ],
      functions: [
        {
          name: "send_lead",
          description: "Envía un lead a HubSpot",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              message: { type: "string" },
              address: { type: "string" },
              bestTime: { type: "string" }
            },
            required: ["email"]
          }
        },
        {
          name: "send_email",
          description: "Envía un correo al cliente",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              text: { type: "string" }
            },
            required: ["to", "subject", "text"]
          }
        }
      ],
      function_call: "auto"
    });

    const responseMessage = completion.choices[0].message;

    // Revisar si el modelo llamó a alguna función
    if (responseMessage.function_call) {
      const { name: fnName, arguments: argsStr } = responseMessage.function_call;
      const args = JSON.parse(argsStr);

      if (fnName === "send_lead") {
        await send_lead(args);
        return res.json({ reply: "Gracias por compartir su información. Continuemos..." });
      }

      if (fnName === "send_email") {
        await send_email(args);
        return res.json({ reply: "📧 Propuesta enviada por correo correctamente." });
      }
    }

    res.json({ reply: responseMessage.content || "No pude generar respuesta." });
  } catch (err) {
    console.error(err);
    res.json({ reply: "❌ Error procesando tu mensaje." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
