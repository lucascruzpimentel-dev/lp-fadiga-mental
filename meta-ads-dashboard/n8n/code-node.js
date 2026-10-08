// Node "Code" do n8n: normaliza o payload do webhook do HighLevel para a tabela `leads`.
// Ajuste os caminhos conforme o payload real (veja a execução do Webhook no n8n).
const b = $input.first().json.body ?? $input.first().json;
const pick = (...keys) => keys.map((k) => b[k] ?? b.customData?.[k] ?? b.contact?.[k]).find((v) => v != null && v !== '') ?? null;

return [{
  json: {
    contact_id: pick('contact_id', 'id'),
    created_time: pick('date_created', 'created_time') || new Date().toISOString(),
    full_name: pick('full_name', 'name'),
    email: pick('email'),
    phone_number: pick('phone', 'phone_number'),
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'), // ID da campanha
    utm_content: pick('utm_content'),   // ID do anúncio
    utm_term: pick('utm_term'),         // ID do conjunto
    origem_midia: pick('origem_midia'),
  },
}];
