import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import { send_lead, send_email } from './functions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para enviar lead a HubSpot
app.post('/api/lead', async (req, res) => {
  const leadData = req.body;
  try {
    await send_lead(leadData);
    res.status(200).json({ message: 'Lead enviado correctamente' });
  } catch (error) {
    console.error('Error enviando lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para enviar email
app.post('/api/email', async (req, res) => {
  const emailData = req.body;
  try {
    await send_email(emailData);
    res.status(200).json({ message: 'Email enviado correctamente' });
  } catch (error) {
    console.error('Error enviando email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Si se accede a cualquier otra ruta, devolver index.html (para SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
