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
  const nameMatch = message.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+/i);
  const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);

  if (nameMatch && phoneMatch) {
    const name = nameMatch[0].trim();
    const phone = phoneMatch[0].replace(/\D/g, '');
    const email = emailMatch ? emailMatch[0] : '';
    const address = message.split('|')[1]?.trim() || message.split(',').slice(2).join(',').trim() || '';

    await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          firstname: name.split(' ')[0],
          lastname: name.split(' ').slice(1).join(' '),
          phone: phone,
          email: email,
          address: address,
          lifecyclestage: 'lead'
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

  const esLead = await capturarLead(message);

  if (esLead) {
    return res.json({ 
      reply: "¡Perfecto! Ya quedó tu información registrada.\nEn minutos te llega tu cotización por email.\n\n¿Cuál es tu factura promedio mensual con LUMA para darte el sistema exacto?" 
    });
  }

  // SI NO ES LEAD → assistant normal (SIN pollIntervalMs)
  try {
    let threadId = sessions.get(sessionId);
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      sessions.set(sessionId, threadId);
    }

    await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
    const run = await openai.beta.threads.runs.createAndPoll(threadId, { assistant_id: ASSISTANT_ID });

    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0].content[0].text.value || "Dime cómo te ayudo";

    res.json({ reply });
  } catch (error) {
    console.error("Error assistant:", error.message);
    res.json({ reply: "Un segundo, estoy preparando tu respuesta..." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("ALEJANDRO 100% VIVO – SIN ERRORES"));
