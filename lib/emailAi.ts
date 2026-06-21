import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

export type AiEmailOpts = {
  action: 'draft' | 'reply' | 'improve' | 'shorten';
  tone?: string;
  text?: string;
  thread?: { subject?: string; counterpart?: string; leadContext?: string; messages?: { direction: string; body: string }[] };
  senderName?: string;
};

export async function aiEmail(opts: AiEmailOpts): Promise<string> {
  const tone = opts.tone || 'Friendly';
  const convo = (opts.thread?.messages || []).slice(-8).map(m => `${m.direction === 'out' ? 'Me' : 'Them'}: ${m.body}`).join('\n\n');
  const system = `You are ${opts.senderName || 'a salesperson'} writing a B2B sales email. Tone: ${tone}. Output ONLY the email body — no subject line, no "Subject:", no preamble, no markdown, no placeholders in brackets. Keep it concise, warm, and human. End with a short sign-off using the sender's first name.`;

  let user = '';
  if (opts.action === 'draft' || opts.action === 'reply') {
    user = `${opts.thread?.leadContext ? `Lead context: ${opts.thread.leadContext}\n\n` : ''}Conversation so far with ${opts.thread?.counterpart || 'the lead'} (subject: ${opts.thread?.subject || ''}):\n\n${convo || '(no prior messages)'}\n\nWrite the next reply from me.`;
  } else if (opts.action === 'improve') {
    user = `Improve this email draft, keeping my intent and meaning. Make it clearer and more polished:\n\n${opts.text || ''}`;
  } else {
    user = `Make this email noticeably shorter and punchier without losing the point:\n\n${opts.text || ''}`;
  }

  const res = await anthropic.messages.create({ model: MODEL, max_tokens: 800, system, messages: [{ role: 'user', content: user }] });
  return res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim();
}
