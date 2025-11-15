import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

app.post("/send_lead", (req, res) => {
  const lead = req.body;
  console.log("Lead recibido:", lead);
  // Aquí llamas a HubSpot u otro CRM
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  const { message, systemChoice, name, phone, address, bestTime } = req.body;

  // Aquí integrarías el Prompt Maestro con GPT
  // Por ahora simulamos respuesta
  let reply = "";
  if (message.toLowerCase().includes("solar")) {
    reply = "🔆 Perfecto, te puedo mostrar los sistemas de energía solar para tu hogar o negocio.";
  } else if (message.toLowerCase().includes("backup")) {
    reply = "⚡ Excelente, te puedo mostrar los backups de alta capacidad para apartamentos u oficinas.";
  } else {
    reply = "Gracias por tu mensaje. Estoy analizando tu solicitud y te responderé con la mejor opción.";
  }

  res.json({ reply });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
