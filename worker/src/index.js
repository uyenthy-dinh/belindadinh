const QUESTION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

function corsHeaders(origin, allowedOrigin) {
  const allow = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shortId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

const DRAFT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function draftAnswer(env, question) {
  try {
    const result = await env.AI.run(DRAFT_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Bạn đang soạn NHÁP câu trả lời giúp Belinda Dinh, người chia sẻ về Content Marketing và ứng dụng AI, giọng văn thẳng thắn, thực tế, không lý thuyết suông, chỉ những gì áp dụng được ngay. Trả lời bằng tiếng Việt, ngắn gọn (dưới 150 từ), đúng trọng tâm câu hỏi. Đây chỉ là bản nháp để Belinda tự đọc và chỉnh sửa trước khi gửi, không phải câu trả lời cuối cùng.",
        },
        { role: "user", content: question },
      ],
    });
    return (result && result.response) ? result.response.trim() : null;
  } catch (err) {
    return null;
  }
}

async function sendTelegramMessage(env, text, replyMarkup) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error("Telegram sendMessage lỗi: " + JSON.stringify(data));
  return data.result;
}

async function sendAnswerEmail(env, { toEmail, toName, question, answer }) {
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#241B2E;">
      <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6C5CE7;font-weight:700;">Belinda Dinh Creative</p>
      <h2 style="font-size:20px;margin:8px 0 16px;">Mình đã trả lời câu hỏi của bạn</h2>
      <p style="font-size:14px;color:#5B4F66;margin:0 0 6px;"><b>Câu hỏi bạn gửi:</b></p>
      <p style="font-size:14px;background:#F6F3F7;border-radius:10px;padding:12px 14px;white-space:pre-wrap;">${escapeHtml(question)}</p>
      <p style="font-size:14px;color:#5B4F66;margin:20px 0 6px;"><b>Trả lời từ Belinda:</b></p>
      <p style="font-size:15px;white-space:pre-wrap;line-height:1.6;">${escapeHtml(answer)}</p>
      <hr style="border:none;border-top:1px solid #E4DEE8;margin:28px 0 16px;">
      <p style="font-size:12px;color:#8C7F97;">Bạn nhận được email này vì đã gửi câu hỏi qua form Hỏi Đáp trên belindadinh.github.io. Trả lời email này nếu muốn hỏi thêm.</p>
    </div>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Belinda Dinh <onboarding@resend.dev>",
      to: [toEmail],
      reply_to: "belindadinh1421@gmail.com",
      subject: "Belinda đã trả lời câu hỏi của bạn",
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Resend gửi email lỗi: " + JSON.stringify(data));
  return data;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function handleAsk(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Dữ liệu gửi lên không hợp lệ." }, 400, headers);
  }

  const name = (body.name || "").toString().trim().slice(0, 100);
  const email = (body.email || "").toString().trim().slice(0, 200);
  const question = (body.question || "").toString().trim().slice(0, 2000);

  if (!name || !isValidEmail(email) || question.length < 5) {
    return json({ ok: false, error: "Vui lòng điền đủ tên, email hợp lệ và câu hỏi." }, 400, headers);
  }

  const id = shortId();
  const record = { id, name, email, question, status: "pending", createdAt: Date.now() };

  const draft = await draftAnswer(env, question);
  const draftBlock = draft
    ? `\n\n🤖 <b>Nháp AI (sửa lại trước khi gửi):</b>\n${escapeHtml(draft)}`
    : `\n\n<i>(AI soạn nháp thất bại lần này, bạn tự viết câu trả lời nhé.)</i>`;

  const notifyText =
    `❓ <b>Câu hỏi mới</b> [${id}]\n` +
    `Từ: ${escapeHtml(name)} (${escapeHtml(email)})\n\n` +
    `${escapeHtml(question)}` +
    draftBlock +
    `\n\n↩️ Copy đoạn nháp (sửa nếu cần) hoặc tự viết câu trả lời, reply tin nhắn này để gửi email cho họ.`;

  let tgMessage;
  try {
    tgMessage = await sendTelegramMessage(env, notifyText);
  } catch (err) {
    return json({ ok: false, error: "Không gửi được thông báo Telegram: " + err.message }, 500, headers);
  }

  await env.QUESTIONS.put(`q:${id}`, JSON.stringify(record), { expirationTtl: QUESTION_TTL_SECONDS });
  await env.QUESTIONS.put(`msg:${tgMessage.message_id}`, id, { expirationTtl: QUESTION_TTL_SECONDS });

  return json({ ok: true, message: "Đã gửi câu hỏi! Belinda sẽ trả lời qua email sớm nhất có thể." }, 200, headers);
}

async function handleTelegramWebhook(request, env) {
  let update;
  try {
    update = await request.json();
  } catch {
    return new Response("ok");
  }

  const message = update.message;
  if (!message || !message.reply_to_message || !message.text) {
    return new Response("ok");
  }

  const repliedId = message.reply_to_message.message_id;
  const questionId = await env.QUESTIONS.get(`msg:${repliedId}`);
  if (!questionId) {
    return new Response("ok");
  }

  const raw = await env.QUESTIONS.get(`q:${questionId}`);
  if (!raw) {
    return new Response("ok");
  }
  const record = JSON.parse(raw);

  if (record.status === "answered") {
    await sendTelegramMessage(env, `⚠️ Câu hỏi [${questionId}] đã được trả lời trước đó rồi, không gửi lại.`);
    return new Response("ok");
  }

  try {
    await sendAnswerEmail(env, {
      toEmail: record.email,
      toName: record.name,
      question: record.question,
      answer: message.text,
    });
    record.status = "answered";
    record.answer = message.text;
    await env.QUESTIONS.put(`q:${questionId}`, JSON.stringify(record), { expirationTtl: QUESTION_TTL_SECONDS });
    await sendTelegramMessage(env, `✅ Đã gửi email trả lời cho ${record.email} (câu hỏi [${questionId}]).`);
  } catch (err) {
    await sendTelegramMessage(env, `❌ Gửi email cho câu hỏi [${questionId}] thất bại: ${err.message}`);
  }

  return new Response("ok");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname === "/ask") {
      return new Response(null, { headers: corsHeaders(request.headers.get("Origin") || "", env.ALLOWED_ORIGIN) });
    }
    if (request.method === "POST" && url.pathname === "/ask") {
      return handleAsk(request, env);
    }
    if (request.method === "POST" && url.pathname === "/telegram-webhook") {
      return handleTelegramWebhook(request, env);
    }
    return new Response("Belinda Hoi Dap worker OK", { status: 200 });
  },
};
