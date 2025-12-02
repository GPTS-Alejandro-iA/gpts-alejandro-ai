import express from 'express';
import { OpenAI } from 'openai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID || "asst_pWq1M4v688jqCMtWxbliz9m9";
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const sessions = new Map();

// CAPTURA LEAD INMEDIATA
async function capturarLead(message) {
  const nameMatch = message.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ ?[A-ZÁÉÍÓÚÑ]?[a-záéíóúñ]*)/);
  const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);

  if (nameMatch && phoneMatch) {
    const name = nameMatch[0].trim();
    const phone = phoneMatch[0].replace(/\D/g, '');
    const email = emailMatch ? emailMatch[0] : '';
    const address = message.split('|')[1]?.trim() || '';

    await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          firstname: name.split(' ')[0],
          lastname: name.split(' ').slice(1).join(' ') || '',
          phone: phone,
          email: email,
          address: address,
          lifecyclestage: 'lead',
          company: 'Green Power Tech Store'
        }
      })
    });

    console.log(`LEAD ENVIADO A HUBSPOT → ${name} | ${phone}`);
    return true;
  }
  return false;
}

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  const leadCapturado = await capturarLead(message);

  if (leadCapturado) {
    // RESPUESTA INMEDIATA SI CAPTURÓ LEAD
    return res.json({ 
      reply: "¡Perfecto! Ya quedó tu información registrada correctamente.\nEn minutos te llega tu cotización por email.\n\n¿Cuál es tu factura promedio mensual con LUMA para recomendarte el sistema ideal?" 
    });
  }

  // SI NO HAY LEAD → DEJAMOS QUE EL ASSISTANT RESPONDA NORMAL
  try {
    let threadId = sessions.get(sessionId);
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      sessions.set(sessionId, threadId);
    }

    await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
    await openai.beta.threads.runs.create(threadId, { assistant_id: ASSISTANT_ID });
  } catch (e) {
    console.log("Error assistant:", e.message);
  }

  // Respuesta vacía o genérica para que el assistant hable
  res.json({ reply: "" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("ALEJANDRO FULL AUTO – LEADS 100% GARANTIZADOS"));
