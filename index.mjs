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

// Ruta principal para recibir mensajes del chat
app.post('/chat', async (req, res) => {
  const { message, name, phone, email, address } = req.body;

  // Validación de datos obligatorios
  if (!name || name.trim().split(' ').length < 2) {
    return res.status(400).json({ success: false, reply: 'Debes ingresar nombre y apellido.' });
  }
  if (!phone || phone.trim() === '') {
    return res.status(400).json({ success: false, reply: 'Debes ingresar tu teléfono.' });
  }

  // Enviar lead a HubSpot
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
          firstname: name.split(' ')[0],
          lastname: name.split(' ').slice(1).join(' '),
          phone: phone,
          address: address || ''
        }
      })
    });
  } catch (err) {
    console.error('Error enviando lead a HubSpot:', err);
    return res.json({ success: false, reply: 'No se pudo enviar el lead a HubSpot.' });
  }

  // Generar respuesta de Alejandro iA vía OpenAI
  let aiReply = '';
  try {
    const response = await fetch(
      `https://api.openai.com/v1/assistants/${process.env.ASSI
