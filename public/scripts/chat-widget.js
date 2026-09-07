/**
 * chat-widget.js
 * Loaded on demand by the tiny inline bootstrap in ChatWidget.astro — never
 * part of the initial page load. Handles opening/closing the panel,
 * submitting messages to /api/chat, and rendering Anthropic's
 * server-sent-event stream progressively as it arrives.
 */

const root = document.getElementById("cga-chat-root");
const toggle = document.getElementById("cga-chat-toggle");
const panel = document.getElementById("cga-chat-panel");
const iconOpen = document.getElementById("cga-chat-icon-open");
const iconClose = document.getElementById("cga-chat-icon-close");
const messagesEl = document.getElementById("cga-chat-messages");
const form = document.getElementById("cga-chat-form");
const input = document.getElementById("cga-chat-input");

const history = []; // { role: "user" | "assistant", content: string }
let isOpen = false;
let isStreaming = false;

function setOpen(open) {
  isOpen = open;
  panel.classList.toggle("hidden", !open);
  panel.classList.toggle("flex", open);
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  iconOpen.classList.toggle("hidden", open);
  iconClose.classList.toggle("hidden", !open);
  if (open) input.focus();
}

// The bootstrap script's click/focus listeners already fired once to load
// this file — the user is expecting the panel to open as a result of that
// same interaction, so we open it immediately on load, then take over
// ordinary toggling from here on.
setOpen(true);
toggle.addEventListener("click", () => setOpen(!isOpen));

function appendMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className =
    role === "user"
      ? "ml-auto max-w-[85%] rounded-lg bg-signal-blue px-3 py-2 text-white"
      : "max-w-[85%] rounded-lg bg-midnight-raised px-3 py-2 text-ink-secondary";
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function appendSystemNotice(text) {
  const notice = document.createElement("div");
  notice.className = "text-center text-[11.5px] text-ink-faint";
  notice.textContent = text;
  messagesEl.appendChild(notice);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function streamAssistantReply() {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history }),
  });

  if (!res.ok) {
    let message = "The assistant is temporarily unavailable — please use the contact form instead.";
    try {
      const errBody = await res.json();
      if (errBody?.message) message = errBody.message;
    } catch {
      // fall through to default message
    }
    appendSystemNotice(message);
    return;
  }

  const bubble = appendMessage("assistant", "");
  let assistantText = "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? ""; // last chunk may be incomplete — keep it for next read

    for (const eventBlock of events) {
      const dataLine = eventBlock.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      let payload;
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue; // malformed frame — skip rather than break the whole stream
      }

      if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
        assistantText += payload.delta.text;
        bubble.textContent = assistantText;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }
  }

  if (assistantText) {
    history.push({ role: "assistant", content: assistantText });
  } else {
    bubble.remove();
    appendSystemNotice("No response came back — please try again or use the contact form.");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isStreaming) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  appendMessage("user", text);
  history.push({ role: "user", content: text });

  isStreaming = true;
  try {
    await streamAssistantReply();
  } catch (err) {
    console.warn("[CloudGrid] Chat stream failed:", err);
    appendSystemNotice("Connection issue — please try again in a moment.");
  } finally {
    isStreaming = false;
  }
});
