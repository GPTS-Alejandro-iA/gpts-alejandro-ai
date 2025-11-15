import express from "express";
import dotenv from "dotenv";
import { send_lead, send_email } from "./functions.js";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static("public"));

// Almacenamiento temporal de historial por cliente (puede mejorar usando DB)
const sessions = {};

// Endpoint principal para recibir mensajes del chat
app.post("/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessions[sessionId]) {
      sessions[sessionId] = { step: 0, lead: {} };
    }

    const session = sessions[sessionId];

    // Flujo de conversación simplificado
    let reply = "";

    switch (session.step) {
      case 0:
        reply = "👋 ¡Hola! Soy Alejandro iA y seré tu Asesor Digital Inteligente de\nGreen Power Tech Store ☀️\nPara empezar, ¿cuál de nuestros sistemas le interesa conocer más?\n• 1.🔆 Energía Solar Fuera de la red\n• 2.⚡ Backups de Alta Capacidad";
        session.step++;
        break;

      case 1:
        if (/1|solar/i.test(message)) {
          session.lead.system = "solar";
          reply = "Perfecto, está interesado en un sistema solar. Para continuar, ¿podría proporcionarme su nombre y número de teléfono, por favor?";
          session.step++;
        } else if (/2|backup/i.test(message)) {
          session.lead.system = "backup";
          reply = "Perfecto, está interesado en un sistema de respaldo. Para continuar, ¿podría proporcionarme su nombre y número de teléfono, por favor?";
          session.step++;
        } else {
          reply = "No entendí tu respuesta. Por favor, elige 1 para Energía Solar o 2 para Backups.";
        }
        break;

      case 2:
        // Extraer nombre y teléfono simple
        const match = message.match(/([A-Za-z\s]+)[,]?[\s]*(\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})/);
        if (match) {
          session.lead.name = match[1].trim();
          session.lead.phone = match[2].replace(/\D/g, "");
          // Enviar a HubSpot
          await send_lead(session.lead);
          reply = `Gracias, ${session.lead.name}. Para continuar con la orientación sobre ${session.lead.system === "solar" ? "energía solar" : "backups"}, ¿desea recibir una propuesta formal por correo electrónico? Si sí, por favor indique su email.`;
          session.step++;
        } else {
          reply = "⚠️ No se proporcionó nombre y teléfono válidos. Por favor indíquelos en el formato: Nombre Completo, 7871234567";
        }
        break;

      case 3:
        // Email para enviar propuesta
        const emailMatch = message.match(/\S+@\S+\.\S+/);
        if (emailMatch) {
          session.lead.email = emailMatch[0];
          await send_email({
            to: session.lead.email,
            subject: "Propuesta formal de Green Power Tech Store",
            text: `Gracias por su interés. Aquí tiene la propuesta formal del sistema recomendado: ${session.lead.system}, precio: [precio], enlace de compra: [URL], beneficios: [resumen breve], garantía: [resumen breve].`
          });
          reply = `La propuesta fue enviada a ${session.lead.email}. La validez de la oferta es de 15 días a partir de hoy.`;
          session.step++;
        } else {
          reply = "⚠️ No se detectó un email válido. Por favor indícalo correctamente para enviar la propuesta.";
        }
        break;

      default:
        reply = "Si desea continuar con otra consulta, por favor indíquelo.";
    }

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Ocurrió un error, por favor inténtalo de nuevo." });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
