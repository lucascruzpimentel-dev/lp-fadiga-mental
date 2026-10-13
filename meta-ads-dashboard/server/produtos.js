// Catálogo de produtos. O HighLevel mistura funis de campanha, ciclo de vida e produto; aqui cada oportunidade
// e cada conversa é ligada a um produto de verdade, para o painel falar de produto e não de nome de funil.
// As regras foram inferidas dos nomes de funil, etapa, valores e conversas. É a parte para o gerente corrigir:
// basta editar este arquivo (nome, descrição, regras) que o painel inteiro acompanha.

export const sa = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Ordem importa: o primeiro que casar vence. Os mais específicos e de maior valor vêm antes.
export const CATALOGO = [
  { id: 'lideres', nome: 'Líderes Atleta Campeão', familia: 'Programa premium', nivel: 5,
    descricao: 'Programa de maior valor do portfólio (oportunidades de R$ 30 mil).', proximo: 'Fechamento consultivo: proposta, contrato e pagamento, de preferência por ligação.',
    funil: /lideres atleta campeao/, etapa: null, texto: null },
  { id: 'pos_neuro', nome: 'Pós em Neurociência e Treinamento Mental', familia: 'Formação (alto ticket)', nivel: 4,
    descricao: 'Pós-graduação em Neurociência e Treinamento Mental (funis PONT).', proximo: 'Qualificar o perfil, apresentar a grade e conduzir à matrícula.',
    funil: /\[pont\]|aluno\] pos neuro/, etapa: /neuroci.*treinamento|pos gradua.*neuroci/, texto: /pos[- ]?gradua\w* em neuroci|neurociencia e treinamento/ },
  { id: 'pos_pse', nome: 'Pós em Psicologia do Esporte e Coaching', familia: 'Formação (alto ticket)', nivel: 4,
    descricao: 'Pós-graduação em Psicologia do Esporte e Coaching (funis POPC e Alunos). É o produto de maior receita por venda (R$ 3,5 mil a R$ 4,5 mil).', proximo: 'Apresentar grade, certificação e condição de pagamento; conduzir à matrícula.',
    funil: /popc|aluno\] pos psicologia/, etapa: /pos gradua.*psicologia do esporte/, texto: /pos[- ]?gradua|pos em psicologia|pos psicologia/ },
  { id: 'black_master', nome: 'Black Master', familia: 'Formação (alto ticket)', nivel: 4,
    descricao: 'Programa avançado do portfólio (vendas entre R$ 444 e R$ 4 mil).', proximo: 'Conduzir à decisão com a condição vigente.',
    funil: /black master/, etapa: /black master/, texto: /black master/ },
  { id: 'atendimento', nome: 'Atendimento Individual', familia: 'Serviço individual', nivel: 3,
    descricao: 'Sessões individuais com especialista (tipicamente R$ 350).', proximo: 'Confirmar horário e forma de pagamento.',
    funil: /atendimento individual/, etapa: /atendimento individual/, texto: /atendimento individual|sessao individual/ },
  { id: 'mentoria', nome: 'Mentoria (Meu Filho Vai Competir)', familia: 'Programa', nivel: 3,
    descricao: 'Mentoria para pais de atletas.', proximo: 'Qualificar a necessidade da família e apresentar a condição.',
    funil: null, etapa: /mentoria/, texto: /mentoria/ },
  { id: 'clp', nome: 'Congresso Liderança Parental', familia: 'Evento (porta de entrada)', nivel: 1,
    descricao: 'Congresso para pais e treinadores, com captação por anúncios (funis CLP). A maioria das conversas é suporte e boas-vindas; o ganho está em levar o participante para a próxima oferta.', proximo: 'Entregar o acesso e apresentar a oferta seguinte (mentoria, ebook ou formação).',
    funil: /\[clp\]|lideranca parental|ebook para pais|manual da arquibancada/, etapa: /lideranca parental/, texto: /lideranca parental|clp/ },
  { id: 'madm', nome: 'Muito Além da Medalha (lista de pais)', familia: 'Evento (porta de entrada)', nivel: 1,
    descricao: 'Lista de captação de pais de atletas (MADM). Entrada para mentoria e ofertas para famílias.', proximo: 'Qualificar a família e apresentar a oferta seguinte (mentoria ou congresso).',
    funil: /madm|muito alem da medalha/, etapa: /madm|muito alem da medalha/, texto: /muito alem da medalha|madm/ },
  { id: 'congresso_pse', nome: 'Congresso de Psicologia do Esporte e Coaching', familia: 'Evento (porta de entrada)', nivel: 1,
    descricao: 'Congresso nacional, vendido como ingresso, passe ou gravação (a partir de R$ 47). Abre a relação com o cliente para a pós-graduação.', proximo: 'Entregar o acesso e, no pós-evento, apresentar a pós-graduação com condição especial.',
    funil: /\[congresso\]|congresso de psicologia|passe/, etapa: /congresso nacional|passe profissional|cerebro do atleta/, texto: /congresso|passe profissional|gravacao/ },
  { id: 'pos_venda', nome: 'Pós-venda e suporte', familia: 'Pós-venda', nivel: 0,
    descricao: 'Suporte, certificados e ementas de quem já comprou.', proximo: 'Resolver e, se houver abertura, oferecer a próxima etapa da jornada.',
    funil: /suporte|envio de certificado|ementas|closer/, etapa: /solucionado|certificado/, texto: null },
  { id: 'prospeccao', nome: 'Prospecção (produto ainda não definido)', familia: 'Prospecção', nivel: 0,
    descricao: 'Leads de social selling e listas, ainda sem um produto definido na oportunidade.', proximo: 'Descobrir o interesse e direcionar para o produto certo.',
    funil: /social sell|\[ig\]|ciclo de vida|quentes|oportunidades gerais|monique/, etapa: null, texto: null },
];
const POR_ID = Object.fromEntries(CATALOGO.map((p) => [p.id, p]));
export const produtoPorId = (id) => POR_ID[id] || POR_ID.prospeccao;

const casa = (re, t) => !!re && re.test(t);

// Produto de uma oportunidade: olha o nome do funil e da etapa (a etapa vale mais, porque no "Portfólio de Produtos" a etapa é o produto).
export function produtoDaOportunidade(o) {
  const f = sa(o.pipeline_nome || o.funil), e = sa(o.etapa_nome || o.etapa);
  for (const p of CATALOGO) if (casa(p.etapa, e)) return p.id;
  for (const p of CATALOGO) if (casa(p.funil, f)) return p.id;
  return 'prospeccao';
}

// Produto de uma conversa: pelo que a conversa diz (motivo e resumo da análise).
export function produtoDaConversa(a) {
  const t = sa(`${a.motivo || ''} ${a.resumo || ''}`);
  for (const p of CATALOGO) if (casa(p.texto, t)) return p.id;
  return null;
}

// O que o cliente costuma perguntar ou objetar, lido do texto das conversas.
export const TEMAS = [
  { id: 'preco', nome: 'Preço e parcelamento', re: /parcel|valor|preco|desconto|condicao especial|pagamento|cartao|pix|boleto/ },
  { id: 'certificacao', nome: 'Certificado e reconhecimento', re: /certificad|reconhec|mec\b|valid/ },
  { id: 'conteudo', nome: 'Conteúdo e grade', re: /ementa|grade|conteudo|modulo|disciplina|carga horaria/ },
  { id: 'acesso', nome: 'Acesso e gravação', re: /acesso|gravacao|link|plataforma|login|senha|liberad/ },
  { id: 'data', nome: 'Datas e horários', re: /data|horario|quando|inicio|turma/ },
];
export const temasDoTexto = (a) => { const t = sa(`${a.motivo || ''} ${a.resumo || ''}`); return TEMAS.filter((x) => x.re.test(t)).map((x) => x.id); };
