// netlify/functions/contact.js
//
// Netlify port of api/contact.js — reached via the /api/contact → this
// function rewrite in netlify.toml, so ContactSection.astro's form can
// point at the single path "/api/contact" regardless of which platform is
// live, instead of the component needing to know which host it's on.
// Logic is identical to the Vercel version; only the base64 encoding
// differs (Buffer is available here since Netlify Functions run on Node,
// not Edge — no need for the btoa() workaround the Vercel port uses).

const NOTIFY_TO = "hello@cloudgridafrica.com";
const NOTIFY_FROM = "CloudGrid Africa Website <onboarding@resend.dev>"; // update once the domain is verified in Resend

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage({ title, heading, body }) {
  return new Response(
    `<!doctype html>
<html lang="en-KE">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>${escapeHTML(title)} — CloudGrid Africa</title>
<style>
  body { background:#0B0F17; color:#E2E8F0; font-family: ui-sans-serif, system-ui, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:2rem; text-align:center; }
  .card { max-width:32rem; }
  h1 { font-size:1.75rem; margin-bottom:0.75rem; }
  p { color:#94A3B8; line-height:1.6; }
  a { color:#3B82F6; text-decoration:none; }
  a:hover { text-decoration:underline; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHTML(heading)}</h1>
    ${body}
    <p style="margin-top:2rem;"><a href="/">← Back to CloudGrid Africa</a></p>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return htmlPage({
      title: "Submission error",
      heading: "We couldn't read that submission",
      body: `<p>Please try again, or email us directly at <a href="mailto:${NOTIFY_TO}">${NOTIFY_TO}</a>.</p>`,
    });
  }

  const honeypot = form.get("company-website");
  if (honeypot) {
    return htmlPage({
      title: "Thanks",
      heading: "Thanks — we'll be in touch.",
      body: `<p>Your request has been received.</p>`,
    });
  }

  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const message = (form.get("message") || "").toString().trim();

  if (!name || !email || !message) {
    return htmlPage({
      title: "Missing information",
      heading: "A few fields were left blank",
      body: `<p>Name, work email, and a short message are all required. Please go back and fill in every field.</p>`,
    });
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return htmlPage({
      title: "Invalid email",
      heading: "That email address doesn't look right",
      body: `<p>Please go back and double-check your email address.</p>`,
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[contact] RESEND_API_KEY is not set — submission not delivered.");
    return htmlPage({
      title: "Temporarily unavailable",
      heading: "Our contact form isn't fully configured yet",
      body: `<p>Please reach us directly instead: <a href="mailto:${NOTIFY_TO}">${NOTIFY_TO}</a> or <a href="tel:+254721656835">+254 721 656 835</a>. We're sorry for the extra step.</p>`,
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        reply_to: email,
        subject: `New consultation request — ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend responded ${res.status}: ${detail}`);
    }
  } catch (err) {
    console.error("[contact] Resend delivery failed:", err);
    return htmlPage({
      title: "Delivery failed",
      heading: "Something went wrong sending your message",
      body: `<p>Please email us directly instead: <a href="mailto:${NOTIFY_TO}">${NOTIFY_TO}</a>. We're sorry for the trouble.</p>`,
    });
  }

  return Response.redirect(new URL("/thank-you", request.url), 303);
};

export const config = {
  path: "/.netlify/functions/contact",
};
