import express from "express";
import dotenv from "dotenv";
import { send_lead, send_email } from "./functions.js"; // Asegúrate de crear este archivo
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(bodyParser.json());

app.post("/chat", async (req, res) => {
  const { message, clientInfo } = req.body;
  let reply = "";

  // Extraer nombre y teléfono del mensaje si no existen
  let updatedInfo = { ...clientInfo };
  const namePhoneRegex = /([\w\s]+),?\s*\(?(\d{3})\)?[-\s]?(\d{3})[-\s]?(\d{4})/;
  const match = message.match(namePhoneRegex);
  if(match) {
    updatedInfo.name = updatedInfo.name || match[1].trim();
    updatedInfo.phone = updatedInfo.phone || `${match[2]}${match[3]}${match[4]}`;
  }

  // Llamar a send_lead si tenemos al menos nombre y teléfono
  if(updatedInfo.name && updatedInfo.phone) {
    try {
      await send_lead({
        name: updatedInfo.name,
        email: updatedInfo.email,
        phone: updatedInfo.phone,
        message
      });
    } catch (err) {
      console.error("Error enviando lead:", err);
    }
  }

  // Generar respuesta de Alejandro iA (simplificada)
  if(!updatedInfo.name || !updatedInfo.phone) {
    reply = "Por favor proporcione su Nombre y Teléfono para continuar la orientación.";
  } else if(!updatedInfo.email && message.toLowerCase().includes("cotización")) {
    reply = "Gracias. Para enviar la cotización, por favor indique su correo electrónico.";
  } else {
    reply = "Gracias por compartir su información. Para comenzar, cuéntame: ¿Cuál sistema le interesa conocer más?\n1. Energía Solar\n2. Backups de Alta Capacidad";
  }

  res.json({ reply, clientInfo: updatedInfo });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
