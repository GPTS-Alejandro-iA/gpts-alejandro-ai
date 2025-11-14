import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para chat
app.post('/chat', (req, res) => {
  const { name, phone, email, address, bestTime, message } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, reply: 'Nombre y teléfono son obligatorios.' });
  }

  console.log('Lead recibido:', { name, phone, email, address, bestTime, message });

  // Simulación de respuesta de Alejandro iA
  const reply = `Hola ${name.split(' ')[0]}, gracias por tus datos. Te responderemos a la brevedad.`;

  res.json({ success: true, reply });
});

// Servir chat.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
