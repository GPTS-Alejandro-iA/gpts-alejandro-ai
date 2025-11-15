import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { send_lead, send_email } from "./functions.js";

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Alejandro iA Webchat está corriendo 🎉");
});

// Ruta para recibir leads desde el chat
app.post("/lead", async (req, res) => {
  try {
    const { name, phone, bestTime, address } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Se requiere al menos nombre y teléfono" });
    }

    // Enviar lead a HubSpot
    await send_lead({ name, phone, bestTime, address });

    // Enviar email (opcional)
    await send_email({ name, phone, bestTime, address });

    return res.json({ success: true, message: "Lead enviado correctamente" });
  } catch (err) {
    console.error("Error procesando lead:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
