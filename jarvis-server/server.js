import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Você é o Jarvis, o assistente pessoal por voz do Rafael.

Sobre o Rafael: estudante de Engenharia de Software (3º semestre), trabalha como
assistente administrativo/financeiro numa empresa de engenharia elétrica, e está
sempre programando algo nas horas vagas.

Ele te usa pra: tirar dúvidas rápidas no dia a dia, ajudar a programar e debugar
código, e pensar em ideias de empreendimento.

Regras importantes, porque suas respostas serão LIDAS EM VOZ ALTA:
- Seja direto e conversacional, como numa ligação. Evite respostas longas demais.
- Não use formatação markdown pesada (títulos, listas extensas, negrito) — isso
  não soa bem em voz. Frases corridas, no máximo uma lista curta se for essencial.
- Quando a resposta envolver código, explique a ideia em poucas frases e coloque
  o código dentro de um bloco \`\`\` — ele vai aparecer na tela formatado, mas só
  a explicação será falada em voz alta.
- Seja preciso e correto, principalmente em programação. Se não tiver certeza,
  diga isso em vez de inventar.`;

// Memória de conversa em RAM, por sessão. Reinicia quando o servidor reinicia.
const sessions = new Map();
const MAX_HISTORY = 20;

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message e sessionId são obrigatórios' });
    }

    const history = getHistory(sessionId);
    history.push({ role: 'user', content: message });

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-MAX_HISTORY)
    ];

    // --- Chamada ao modelo (OpenAI) ---
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });
    const reply = completion.choices[0].message.content;

    /* Pra usar Claude (Anthropic) no lugar da OpenAI:
       1. npm install @anthropic-ai/sdk
       2. import Anthropic from '@anthropic-ai/sdk';
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
       3. Troque o bloco acima por:
          const completion = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: history.slice(-MAX_HISTORY)
          });
          const reply = completion.content[0].text;
    */

    history.push({ role: 'assistant', content: reply });
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao falar com o modelo: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Jarvis rodando em http://localhost:${PORT}`));
