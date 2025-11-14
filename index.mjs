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

  if (!message || !name || !phone) {
    return res.status(400).json({ success: false, reply: 'Faltan datos obligatorios: nombre completo y teléfono.' });
  }

  // Separar nombre y apellido
  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '-';

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
          email: email || '',
          firstname: firstName,
          lastname: lastName,
          phone,
          address: address || '',
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
      from: proces
