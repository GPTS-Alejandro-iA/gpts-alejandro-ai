import express from 'express';
import { OpenAI } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = "asst_pWq1M4v688jqCMtWxbliz9m9";
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN; // ← pon tu token real aquí o en .env

const sessions = new Map();

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  let threadId = sessions.get(sessionId);
  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    sessions.set(sessionId, threadId);
  }

  await openai.beta.threads.messages.create(threadId, { role: "user", content: message });

  let run = await openai.beta.threads.runs.create(threadId, { assistant_id: ASSISTANT_ID });

  while (["queued", "in_progress", "requires_action"].includes(run.status)) {
    if (run.status === "requires_action") {
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;

      const toolOutputs = await Promise.all(toolCalls.map(async tool => {
        if (tool.function.name === "send_lead") {
          const args = JSON.parse(tool.function.arguments);

          // ENVÍO REAL A HUBSPOT
          await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: {
                firstname: args.name.split(' ')[0] || '',
                lastname: args.name.split(' ').slice(1).join(' ') || '',
                phone: args.phone || '',
                email: args.email || '',
                address: args.address || '',
                company: 'Green Power Tech Store - Lead Alejandro AI'
              }
            })
          });

          console.log("LEAD ENVIADO A HUBSPOT:", args);
          return { tool_call_id: tool.id, output: JSON.stringify({ success: true }) };
        }
        return { tool_call_id: tool.id, output: JSON.stringify({ success: true }) };
      }));

      run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: toolOutputs });
    } else {
      await new Promise(r => setTimeout(r, 800));
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
  }

  if (run.status === "completed") {
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0].content[0].text.value;
    res.json({ reply });
  } else {
    res.json({ reply: "Un segundo, estoy terminando de procesar tu info..." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Alejandro AI + HubSpot 100% vivo en puerto ${PORT}`));
