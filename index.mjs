import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { send_lead, send_email } from "./functions.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

app.post("/chat", async (req, res) => {
  const { message, leadData, emailData } = req.body;

  // Aquí integrarías tu llamada al modelo GPT-4.1 con message
  // Para simulación:
  let responseText = "Hola 👋, soy Alejandro Ai. ¿En qué sistema estás interesado?";

  // Captación de lead
  if (leadData && leadData.name && leadData.phone) {
    await send_lead(leadData);
  }

  // Envío de correo
  if (emailData && emailData.to && emailData.subject && emailData.text) {
    await send_email(emailData);
  }

  res.json({ reply: responseText });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
