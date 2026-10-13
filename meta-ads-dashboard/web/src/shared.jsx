// Peças compartilhadas pelas abas Atendimentos e Equipe.
export const CAT = { suporte_acesso: 'Suporte / acesso', outro: 'Outros', evento: 'Evento', duvida_produto: 'Dúvida sobre produto', compra: 'Compra', pagamento_financeiro: 'Pagamento', reclamacao: 'Reclamação', cancelamento_reembolso: 'Cancelamento / reembolso' };
export const ALERTA = { cliente_insatisfeito: 'Cliente insatisfeito', cliente_sem_resposta: 'Sem retorno', risco_reembolso: 'Risco de reembolso', erro_do_atendente: 'Erro do atendente', informacao_incorreta: 'Informação incorreta' };

export function notaClass(n) {
  if (n == null) return 'bg-slate-100 text-slate-500';
  if (n >= 8) return 'bg-emerald-100 text-emerald-800';
  if (n >= 6) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

// "Onde errou e como melhorar": o trecho da conversa, o problema e o que fazer no lugar.
export function Evidencias({ itens }) {
  if (!itens?.length) return <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Este caso não tem trecho registrado da conversa. Veja o resumo e os pontos de melhoria acima.</p>;
  return (
    <div className="space-y-3">
      {itens.map((e, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-red-700">O que aconteceu{e.horario ? ` · ${e.horario}` : ''}</p>
          <p className="rounded bg-white px-2 py-1 italic text-slate-700">{e.trecho}</p>
          <p><span className="font-semibold">Problema: </span>{e.problema}</p>
          <p><span className="font-semibold text-emerald-700">Como melhorar: </span>{e.como_melhorar}</p>
          {e.resposta_sugerida && <p className="rounded bg-emerald-50 px-2 py-1 text-emerald-900"><span className="font-semibold">Resposta sugerida: </span>{e.resposta_sugerida}</p>}
        </div>
      ))}
    </div>
  );
}
