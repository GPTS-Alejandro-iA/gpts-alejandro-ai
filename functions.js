import fetch from "node-fetch";
import nodemailer from "nodemailer";

// ====== SEND LEAD A HUBSPOT ======
export async function send_lead({ name, phone, email, address, preferred_time }) {
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  const url = `https://api.hubapi.com/crm/v3/objects/contacts`;

  const body = {
    properties: {
      firstname: name.split(" ")[0] || "",
      lastname: name.split(" ").slice(1).join(" ") || "",
      phone: phone || "",
      email: email || "",
      address: address || "",
      hs_lead_status: "New",
      preferred_contact_time: preferred_time || ""
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${HUBSPOT_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    console.error("Error sending lead to HubSpot:", await response.text());
    return false;
  }

  const data = await response.json();
  console.log("Lead sent to HubSpot:", data);
  return data;
}

// ====== SEND EMAIL ======
export async function send_email({ to, subject, text }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // tu gmail
      pass: process.env.EMAIL_PASS  // app password
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return info;
  } catch (err) {
    console.error("Error sending email:", err);
    return false;
  }
}
