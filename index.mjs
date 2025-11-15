import express from "express";
import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

// Configuración OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Map para manejar estados de conversación por cliente (puede ser por IP o sessionId)
const sessions = new Map();

// Función para enviar leads a HubSpot (simulada aquí)
async function send_lead({ name, email, phone, message }) {
  console.log("Lead recibido:", { name, email, phone, message });
  // Aquí va la integración real con HubSpot
}

// Función para enviar emails
async function send_email({ to, subject, text }) {
  // Configurar transporte
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text });
  console.log("Correo enviado a:", to);
}

// Función para generar respuestas de Alejandro iA
async function alejandroIAResponse(sessionId, userMessage) {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      step: "start",
      data: {},
      tipoSistema: null
    };
    sessions.set(sessionId, session);
  }

  const lowerMsg = userMessage.toLowerCase();

  switch (session.step) {
    case "start":
      session.step = "askSistema";
      return `👋 ¡Hola! Soy Alejandro iA, tu asesor solar de Green Power Tech Store.
Estoy aquí para orientarte sobre todos nuestros sistemas y responder tus preguntas. Para empezar, ¿Cuál de nuestros sistemas le interesa conocer más?
1. 🔆 Energía Solar Fuera de la red
2. ⚡ Backups de Alta Capacidad`;

    case "askSistema":
      if (lowerMsg.includes("solar") || lowerMsg.includes("1")) {
        session.tipoSistema = "Energía Solar";
      } else if (lowerMsg.includes("backup") || lowerMsg.includes("2")) {
        session.tipoSistema = "Backups";
      } else {
        return "Por favor indica 1 o 2 para seleccionar el sistema de interés.";
      }
      session.step = "askInfo";
      return `Perfecto. Antes de continuar, para ofrecerle una orientación adecuada y prepararle una cotización formal, por favor compártenos tu información mínima:  
1. Nombre y Apellido  
2. Teléfono`;

    case "askInfo":
      // Extraer datos básicos con regex simple
      const nameMatch = userMessage.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
      const phoneMatch = userMessage.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);

      if (nameMatch) session.data.name = nameMatch[0];
      if (phoneMatch) session.data.phone = phoneMatch[0];

      if (!session.data.name || !session.data.phone) {
        return "Por favor proporciona al menos tu nombre completo y tu teléfono para continuar.";
      }

      // Guardar lead
      await send_lead({
        name: session.data.name,
        email: session.data.email || "",
        phone: session.data.phone,
        message: userMessage
      });

      session.step = "orientacion";
      return `Gracias por compartir su información. Para comenzar, cuéntame más sobre tus necesidades en ${session.tipoSistema}.`;

    case "orientacion":
      // Aquí podrías hacer una llamada a OpenAI para generar la recomendación
      // Por simplicidad, dejamos un mensaje de ejemplo
      session.step = "final";
      return `Basado en tu interés en ${session.tipoSistema}, te recomiendo el sistema XYZ.  
Precio total: $10,000  
Pago mensual aproximado a 10 años (100%): $100/mes  
Pago mensual aproximado a 10 años (110%): $110/mes  

Si deseas que te enviemos la propuesta formal por correo electrónico, por favor indícanos tu email.`;

    case "final":
      const emailMatch = userMessage.match(/\S+@\S+\.\S+/);
      if (emailMatch) {
        session.data.email = emailMatch[0];
        await send_email({
          to: session.data.email,
          subject: "Propuesta formal de Green Power Tech Store",
          text: `Gracias por su interés. Aquí tiene la propuesta formal del sistema recomendado: XYZ, precio: $10,000, enlace de compra: https://greenpowertech.store/compra, beneficios: Independencia energética, ahorro en factura eléctrica, garantía: 10 años.`
        });
        session.step = "done";
        return `La propuesta ha sido enviada a ${session.data.email}. La validez de esta oferta es de 15 días a partir de hoy.`;
      } else {
        return "Por favor proporciona un correo electrónico válido si deseas recibir la propuesta formal.";
      }

    case "done":
      return "Gracias por tu tiempo. Si deseas más orientación, estamos disponibles para ayudarte. ¡Que tengas un excelente día!";

    default:
      return "Lo siento, no entendí tu mensaje. Por favor, intenta nuevamente.";
  }
}

// Endpoint para el chat
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!sessionId) return res.json({ reply: "Error: falta sessionId" });

    const reply = await alejandroIAResponse(sessionId, message);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.json({ reply: "❌ Error procesando el mensaje." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
