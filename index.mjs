  // ANTES (la que tienes ahora):
  res.json({ reply: "¡Perfecto! Ya tengo tus datos. En segundos te llega tu cotización por email. ¿Cuál es tu factura promedio mensual con LUMA?" });

  // DESPUÉS (esta es la correcta):
  if (nameMatch && phoneMatch) {
    res.json({ reply: "¡Perfecto! Ya quedó tu información registrada correctamente. En minutos te llega tu cotización por email. ¿Cuál es tu factura promedio mensual con LUMA para recomendarte el sistema ideal?" });
  } else {
    // Dejamos que el assistant responda normalmente
    // (no respondemos nada aquí, solo seguimos con el thread)
    setTimeout(async () => {
      try {
        let threadId = sessions.get(sessionId) || (await openai.beta.threads.create()).id;
        sessions.set(sessionId, threadId);
        await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
        const run = await openai.beta.threads.runs.create(threadId, { assistant_id: ASSISTANT_ID });
      } catch (e) { console.log(e); }
    }, 100);
    return res.json({ reply: "" }); // respuesta vacía → el assistant habla normal
  }
