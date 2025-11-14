import express from 'express';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Configuración de nodemailer para Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Ruta principal para enviar mensajes al chat
app.post('/chat', async (req, res) => {
  const { message, name, email, phone, address, bestTime } = req.body;

  if (!message || !name || !email || !phone) {
    return res.status(400).json({ success: false, reply: 'Faltan datos obligatorios.' });
  }

  // 1️⃣ Enviar lead a HubSpot
  try {
    await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        properties: {
          email,
          firstname: name.split(' ')[0],
          lastname: name.split(' ').slice(1).join(' ') || '-',
          phone,
          address,
          best_time_to_call: bestTime || ''
        }
      })
    });
  } catch (err) {
    console.error('Error enviando lead a HubSpot:', err);
    return res.json({ success: false, reply: 'No se pudo enviar el lead a HubSpot.' });
  }

  // 2️⃣ Generar respuesta de Alejandro iA vía OpenAI
  let aiReply = '';
  try {
    const response = await fetch(
      `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/message`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: [{ role: 'user', content: message }]
        })
      }
    );

    const data = await response.json();
    aiReply = data.output?.[0]?.content?.[0]?.text || 'Lo siento, no pude generar respuesta.';
  } catch (err) {
    console.error('Error generando respuesta de AI:', err);
    aiReply = 'Lo siento, hubo un error generando la respuesta.';
  }

  // 3️⃣ Enviar cotización / email al cliente
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Cotización de Green Power Tech',
      text: `Hola ${name}, gracias por tu interés en nuestros sistemas solares.\n\nTe responderemos a la brevedad.\n\nMensaje original: ${message}`
    });
  } catch (err) {
    console.error('Error enviando email:', err);
  }

  return res.json({ success: true, reply: aiReply });
});

// Servir index.html en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir chat.html si quieres interfaz separada
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
