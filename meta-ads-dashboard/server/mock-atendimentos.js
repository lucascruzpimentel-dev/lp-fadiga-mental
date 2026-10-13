// Dados de exemplo para a aba Atendimentos (modo demonstração). Determinísticos: o mesmo dia gera sempre os mesmos casos.
const addDias = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);

function rng(seed) {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 5; i++) next(); // descarta as primeiras sorteadas, que ficam parecidas entre sementes próximas
  return next;
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

const CATS = ['duvida_produto', 'compra', 'suporte_acesso', 'evento', 'pagamento_financeiro', 'reclamacao', 'cancelamento_reembolso', 'outro'];
const VENDEDORES = ['user-ana-0001', 'user-bruno-0002', 'user-carla-0003'];
const MOTIVOS = {
  duvida_produto: ['Quer saber o conteúdo e o valor da formação em Psicologia do Esporte.', 'Pergunta se o curso dá certificado reconhecido.'],
  compra: ['Quer se inscrever no congresso e pede o link de pagamento.', 'Pergunta se há parcelamento no cartão.'],
  suporte_acesso: ['Não consegue acessar a área de membros.', 'Não recebeu o e-mail com a senha de acesso.'],
  evento: ['Quer o link da aula ao vivo de hoje.', 'Pergunta o horário do congresso.'],
  pagamento_financeiro: ['Pagou por Pix e o acesso não liberou.', 'Pede segunda via do boleto.'],
  reclamacao: ['Reclama que esperou muito por uma resposta.', 'Diz que a aula ao vivo caiu no meio.'],
  cancelamento_reembolso: ['Pede reembolso dentro dos 7 dias.', 'Quer cancelar a assinatura.'],
  outro: ['Mensagem sem assunto claro.', 'Quer falar com a coordenação.'],
};
const FORTES = ['Resposta clara e cordial', 'Enviou o link e o próximo passo', 'Chamou o cliente pelo nome', 'Resolveu na primeira resposta'];
const MELHORIAS = ['Responder o primeiro contato em poucos minutos', 'Fazer uma pergunta de qualificação antes de oferecer', 'Terminar com um convite claro para inscrição', 'Retomar o contato depois de 1 dia sem resposta'];
const NOMES = ['Marcos Oliveira', 'Fernanda Lima', 'Ricardo Alves', 'Juliana Prado', 'Paulo Henrique', 'Camila Duarte', 'Renato Souza', 'Patrícia Gomes', 'André Barros', 'Larissa Nunes'];
const EVID = [
  { trecho: 'Cliente: "Qual o valor do congresso?"  →  Atendente: "Já te passo os detalhes."', problema: 'Não respondeu a pergunta sobre o valor; o cliente precisou perguntar de novo 25 min depois.', como_melhorar: 'Responder o valor na mesma mensagem e já enviar o link de inscrição.', resposta_sugerida: 'O investimento do 2º lote é R$ 247. Segue o link para garantir sua vaga: [link]. Qualquer dúvida estou aqui!' },
  { trecho: 'Cliente: "Posso parcelar?"  →  (sem resposta por 2h10)', problema: 'Pergunta de decisão de compra ficou 2h10 sem retorno.', como_melhorar: 'Priorizar perguntas de compra: responder em até 5 min e confirmar o parcelamento.', resposta_sugerida: 'Pode sim! Parcelamos em até 12x no cartão. Quer que eu envie o link já com o parcelamento?' },
  { trecho: 'Atendente: "É só acessar o site e se inscrever."', problema: 'Não enviou o link nem o passo a passo; o cliente respondeu "qual site?".', como_melhorar: 'Enviar o link e o próximo passo na mesma mensagem.', resposta_sugerida: 'Para se inscrever, acesse [link] e clique em "Quero participar". Se travar em algum passo, me chame aqui.' },
  { trecho: 'Cliente: "Não recebi o acesso"  →  Atendente: "Vou verificar."  →  (conversa encerrada)', problema: 'Disse que ia verificar, mas não voltou com a solução.', como_melhorar: 'Fechar o ciclo: avisar o resultado ou combinar um prazo.', resposta_sugerida: 'Liberei seu acesso agora. Você receberá o e-mail em até 5 min. Se não chegar, me avise por aqui.' },
];
const ACOES = ['Enviar o link de inscrição e confirmar o pagamento.', 'Ligar para o cliente e oferecer o parcelamento.', 'Liberar o acesso manualmente e avisar por WhatsApp.', 'Retomar a conversa amanhã com um motivo novo.', 'Encaminhar ao financeiro para conferir o Pix.'];

export function mockCasos(de, ate) {
  const out = [];
  for (let d = de; d <= ate; d = addDias(d, 1)) {
    const r = rng(d);
    const fim = new Date(d + 'T12:00:00Z').getUTCDay();
    const n = (fim === 0 || fim === 6 ? 4 : 11) + Math.floor(r() * 7);
    for (let i = 0; i < n; i++) {
      const cat = pick(r, CATS);
      const resolvido = r() < 0.62;
      const nomeC = pick(r, NOMES);
      const neg = cat === 'reclamacao' ? r() < 0.8 : r() < 0.12;
      const semResp = !resolvido && r() < 0.3;
      const hora = 11 + Math.floor(r() * 10); // 08h–18h em Brasília
      const min = Math.floor(r() * 60);
      out.push({
        conversation_id: `${d.replace(/-/g, '')}-${String(i).padStart(2, '0')}`,
        contact_id: `ct${Math.floor(r() * 1e8)}`,
        contato_nome: nomeC,
        contato_telefone: `+55 11 9${String(Math.floor(r() * 1e8)).padStart(8, '0').replace(/(\d{4})(\d{4})/, '$1-$2')}`,
        inicio: `${d}T${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`,
        categoria: cat,
        sentimento: neg ? 'negativo' : resolvido ? 'positivo' : 'neutro',
        resolvido,
        nota: Math.max(2, Math.min(10, Math.round((resolvido ? 8 : 5) + (r() - 0.5) * 4 - (neg ? 2 : 0)))),
        atendentes: r() < 0.9 ? [pick(r, VENDEDORES)] : [],
        oportunidade_venda: (cat === 'compra' || cat === 'duvida_produto') && r() < 0.6,
        alerta: semResp ? 'cliente_sem_resposta' : neg ? 'cliente_insatisfeito' : cat === 'cancelamento_reembolso' ? 'risco_reembolso' : 'nenhum',
        primeira_resposta_seg: Math.round(60 + r() * r() * 5400),
        qtd_mensagens: 4 + Math.floor(r() * 18),
        resumo: `${pick(r, MOTIVOS[cat])} ${resolvido ? 'A equipe resolveu a demanda na própria conversa.' : 'A demanda segue em aberto e precisa de retorno.'}`,
        motivo: pick(r, MOTIVOS[cat]),
        proxima_acao: resolvido ? '' : pick(r, ACOES),
        pontos_fortes: r() < 0.7 ? [pick(r, FORTES)] : [],
        pontos_melhoria: r() < 0.6 ? [pick(r, MELHORIAS)] : [],
      });
      const u = out[out.length - 1];
      if ((cat === 'compra' || cat === 'duvida_produto') && r() < 0.4) u.venda_valor = pick(r, [247, 347, 497, 1297]);
      if (u.pontos_melhoria.length || u.nota <= 6) u.evidencias = [{ horario: `${String(hora - 3).padStart(2, '0')}:${String((min + 12) % 60).padStart(2, '0')}`, ...pick(r, EVID) }];
    }
  }
  return out;
}

export function mockConversa(id) {
  const r = rng(id);
  const falas = [
    ['cliente', 'Cliente', 'Oi, boa tarde! Queria saber mais sobre a formação.'],
    ['atendente', 'Ana', 'Boa tarde! Tudo bem? Claro, posso te explicar. Você é psicólogo ou treinador?'],
    ['cliente', 'Cliente', 'Sou treinador de base. Qual o valor e como funciona?'],
    ['atendente', 'Ana', 'São aulas ao vivo e gravadas, com certificado. Te mando o link com os detalhes agora.'],
    ['cliente', 'Cliente', 'Perfeito, pode mandar.'],
    ['atendente', 'Ana', 'Enviado! Qualquer dúvida estou por aqui.'],
  ].slice(0, 4 + Math.floor(r() * 3));
  return {
    texto_disponivel: true,
    mensagens: falas.map(([de, quem, texto], i) => ({ quando: `${String(14 + Math.floor(i / 4)).padStart(2, '0')}:${String(10 + i * 3).padStart(2, '0')}`, de, quem, texto })),
  };
}
