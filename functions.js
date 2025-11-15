import fetch from "node-fetch"; // Si Node v22, fetch ya está global
import nodemailer from "nodemailer";

// --- HubSpot Lead ---
export async function send_lead({ name, phone, bestTime, address }) {
  const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

  const url = "https://api.hubapi.com/crm/v3/objects/contacts";

  const data = {
    properties: {
      firstname: name,
      phone: phone,
      address: address || "",
      best_time_to_call: bestTime || "",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${HUBSPOT_TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error enviando lead a HubSpot:", errorText);
    throw new Error(`HubSpot API error: ${errorText}`);
  }

  return await response.json();
}

// --- Envío de Email ---
export async function send_email({ name, phone, bestTime, address }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"Alejandro iA" <${process.env.SMTP_USER}>`,
    to: process.env.LEADS_EMAIL,
    subject: "Nuevo Lead de Alejandro iA",
    text: `Nombre: ${name}\nTeléfono: ${phone}\nHora: ${bestTime}\nDirección: ${address || ""}`,
  };

  await transporter.sendMail(mailOptions);
}
