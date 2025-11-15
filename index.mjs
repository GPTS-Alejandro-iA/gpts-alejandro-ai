import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { send_lead, send_email } from "./functions.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" });
});

// Endpoint para recibir mensajes del chat
app.post("/api/message", async (req, res) => {
  try {
    const { userMessage, userData } = req.body;

    // Aquí puedes integrar GPT-4.1 mini para la respuesta
    // Ejemplo simplificado:
    let botResponse = "";

    if (!userData?.name || !userData?.phone) {
      botResponse = "⚠️ Necesitamos al menos tu nombre y teléfono para continuar.";
    } else {
      botResponse = `Hola ${userData.name}, gracias por tus datos. ¿Deseas que te enviemos la propuesta formal por correo?`;
      // Llamada a función send_lead
      await send_lead(userData);
    }

    res.json({ response: botResponse });
  } catch (err) {
    console.error("Error en /api/message:", err);
    res.status(500).json({ error: "Error procesando el mensaje." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
