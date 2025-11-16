const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = userInput.value.trim();
  if (!message) return;

  appendMessage(message, "user-message");
  userInput.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;

  appendMessage("Alejandro Ai está escribiendo...", "bot-message", true);

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    const botMessageEl = chatBox.querySelector(".bot-message.typing");
    if (botMessageEl) botMessageEl.remove();

    appendMessage(data.reply, "bot-message");
    chatBox.scrollTop = chatBox.scrollHeight;

  } catch (err) {
    console.error(err);
    const botMessageEl = chatBox.querySelector(".bot-message.typing");
    if (botMessageEl) botMessageEl.textContent = "Error al enviar el mensaje.";
  }
});

function appendMessage(text, className, typing=false) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", className);
  if (typing) messageEl.classList.add("typing");
  messageEl.textContent = text;
  chatBox.appendChild(messageEl);
}
