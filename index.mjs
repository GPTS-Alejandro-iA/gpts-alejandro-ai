import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const OWNER_PHONE = process.env.OWNER_PHONE || "17876992140";
const WHATSAPP_KEY = process.env.WHATSAPP_KEY || "123456";

async function enviarLead(nombre, telefono, email = '', direccion = '') {
  telefono = telefono.replace(/\D/g, '');

  await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        firstname: nombre.split(' ')[0] || 'SinNombre',
        lastname: nombre.split(' ').slice(1).join(' ') || '',
        phone: telefono,
        email: email || '',
        address: direccion || '',
        lifecyclestage: 'lead',
        company: 'Green Power Tech Store'
      }
    })
  });

  const texto = encodeURIComponent(`LEAD NUEVO\n${nombre}\n${telefono}\n${email||'sin email'}\n${direccion||'sin dirección'}`);
  await fetch(`https://api.callmebot.com/whatsapp.php?phone=${OWNER_PHONE}&text=${texto}&apikey=${WHATSAPP_KEY}`);

  console.log(`LEAD CAPTURADO → ${nombre} | ${telefono}`);
}

app.post('/chat', async (req, res) => {
  const message = req.body.message?.trim() || '';

  const nameMatch = message.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*/i);
  const phoneMatch = message.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

  if (nameMatch && phoneMatch) {
    const nombre = nameMatch[0].trim();
    const telefono = phoneMatch[0];
    const email = message.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || '';
    const direccion = message.split(',').slice(2).join(',').trim() || '';

    await enviarLead(nombre, telefono, email, direccion);

    return res.json({
      reply: `Gracias, ${nombre.split(' ')[0]}.\nHemos registrado su información correctamente.\nEn breve lo contactaremos para coordinar su cotización personalizada y visita técnica.\nGreen Power Tech Store`
    });
  }

  res.json({
    reply: `Buenos días / Buenas tardes.\nSoy Alejandro de Green Power Tech Store.\n\nPara preparar su cotización personalizada y contactarlo de inmediato, necesito:\n• Nombre y apellidos\n• Teléfono de contacto\n\nPor favor envíelos y lo atenderemos en minutos.`
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("BOT PROFESIONAL ACTIVO – LEADS 100% GARANTIZADOS"));
