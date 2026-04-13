import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { RewriteGiftNoteBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/gifted/rewrite-note", async (req, res) => {
  const parsed = RewriteGiftNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { currentNote, occasion, recipientName, senderName, intent, giftTitle, mode } = parsed.data;

  const systemPrompt = `You are a thoughtful, warm, emotionally intelligent copywriter for gifted. — a premium digital gifting platform.
Your job is to write personal notes from a gift sender to a recipient.

The notes you write should feel:
- Warm, genuine, and human — not generic or robotic
- Emotionally resonant but not over-the-top or cheesy
- Brief and personal — typically 2-4 sentences
- Natural and conversational, as if written by a real person
- Tailored to the specific occasion and relationship context

Never use clichés like "on this special day" or overly formal language.
Do not add a salutation (like "Dear Sarah") or a sign-off (like "Love, Jamie") — those are handled separately.
Return only the note text with no explanation.`;

  let userPrompt: string;

  if (mode === "rewrite" && currentNote) {
    userPrompt = `Rewrite the following personal gift note so it reads beautifully — like the sender at their absolute best.

Your job is to capture the emotion and intent behind what they wrote, then express it in a way that feels genuinely warm and memorable. You have creative freedom with the words and phrasing, but must stay true to the spirit of what they meant.

Rules:
- Match the sender's tone and register. If they wrote casually, stay casual but elevated. If they wrote warmly, make it warmer. Never turn a simple heartfelt note into something stiff or formal.
- Do NOT invent new facts, memories, or details they did not include. Only work with what they gave you.
- Do NOT add greetings (like "Dear ${recipientName}") or sign-offs (like "Love, ${senderName}") — those are handled separately.
- Keep it concise — 2-4 sentences. Do not pad it out.
- Return only the note text, no explanation, no quotation marks.

Sender: ${senderName}
Recipient: ${recipientName}

Original note:
${currentNote}

Write the rewritten note only.`;
  } else {
    userPrompt = `Write a short, heartfelt personal note for this gift.

Context:
- Occasion: ${occasion}
- This gift is from ${senderName} to ${recipientName}
${intent ? `- The intention behind this gift is: ${intent}` : ""}
${giftTitle ? `- Gift title/headline: ${giftTitle}` : ""}

The note should feel genuine and personal — as if ${senderName} wrote it themselves.
Write the note text only, no explanation.`;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("AI note rewrite error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI generation failed" })}\n\n`);
    res.end();
  }
});

export default router;
