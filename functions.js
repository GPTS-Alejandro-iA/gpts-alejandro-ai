// functions.js
import fetch from "node-fetch";
import nodemailer from "nodemailer";

// Configuración de HubSpot desde variables de entorno
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

// Configuración de Nodemailer desde variables de entorno
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO; // Dirección que recibirá los leads

// Función para enviar lead a HubSpot
export async function send_lead({ name, email, phone, message }) {
  try {
    const url = "https://api.hubapi.com/crm/v3/objects/contacts";

    const body = {
      properties: {
        firstname: name,
        email: email,
        phone: phone || "",
        message: message || "",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${JSON.stringify(data)}`);
    }

    console.log("Lead enviado a HubSpot:", data);
    return data;
  } catch (error) {
    console.error("Error enviando lead a HubSpot:", error);
    throw error;
  }
}

// Función para enviar correo
export async function send_email({ name, email, phone, message }) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // o el que uses
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: EMAIL_USER,
      to: EMAIL_TO,
      subject: `Nuevo Lead de ${name}`,
      html: `
        <h2>Nuevo Lead recibido</h2>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Teléfono:</strong> ${phone || "No proporcionado"}</p>
        <p><strong>Mensaje:</strong> ${message || "No proporcionado"}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error enviando correo:", error);
    throw error;
  }
}
