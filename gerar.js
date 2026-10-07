#!/usr/bin/env node
/**
 * GERADOR DO GANTT — quadro Marketing IMendes
 *
 * Le o Trello e escreve site/index.html. Roda sozinho pelo GitHub Actions.
 * As credenciais vem dos segredos do repositorio: nunca ficam neste arquivo
 * nem na pagina publicada.
 *
 * Para rodar na sua maquina:
 *   TRELLO_KEY=... TRELLO_TOKEN=... node gerar.js
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// AJUSTES — tudo o que voce costuma querer mudar esta aqui
// ---------------------------------------------------------------------------
var QUADRO            = 'OSUggP6K';        // codigo do quadro na URL do Trello
var COLUNAS_EXCLUIDAS = ['FINALIZADO', 'ESTRATÉGICOS', 'ENTRADA DE BRIEFING',
                         'STAND BY', 'FIGUEIREDO MEDIA'];
var INDICADORES       = ['ENTRADA DE BRIEFING', 'STAND BY', 'FINALIZADO'];
var MESES_PARA_TRAS   = 12;                // quanto do passado o eixo mostra
var TITULO            = 'Marketing IMendes / mapa de entregas';
var TEMA              = 'claro';           // 'claro' (cinza) ou 'escuro' (navy)

// A pagina do GitHub Pages e publica. Com false, os titulos dos cards viram
// "Card #123" e nada confidencial sai do Trello. Barras, prazos, responsaveis
// e contagens continuam iguais.
var MOSTRAR_TITULOS   = true;

// ---------------------------------------------------------------------------
// Daqui para baixo nao precisa mexer.
// ---------------------------------------------------------------------------
const CHAVE = process.env.TRELLO_KEY;
const TOKEN = process.env.TRELLO_TOKEN;

var CORES_FIXAS = {
  alexandreabdossantos: '#E8825A',
  caiqueferreira1: '#E86FA8',
  irvingspinellimalaguti: '#4E9BE8',
  mateusasafecavalcantidasilva: '#7FE05A',
  ricardogalinavicente: '#B47CE8',
  matheusvalencio: '#34C7A0',
  mktimendes: '#7A839E'
};
var PALETA = ['#E8B04E', '#5AD1E8', '#D67CA0', '#8FA0E8',
              '#6FD08A', '#E0906F', '#A88FE0', '#5FC0B0'];

/* ------------------------------------------------------------- Trello ---- */

async function chamar(caminho, params) {
  var q = [];
  for (var k in params) { q.push(k + '=' + encodeURIComponent(params[k])); }
  var r = await fetch('https://api.trello.com/1' + caminho + '?' + q.join('&'), {
    headers: {
      Accept: 'application/json',
      // Credenciais no cabecalho: nao entram na URL nem em log de acesso.
      Authorization: 'OAuth oauth_consumer_key="' + CHAVE + '", oauth_token="' + TOKEN + '"'
    }
  });
  if (r.status === 401 || r.status === 400) {
    throw new Error('O Trello recusou as credenciais. Confira os segredos '
      + 'TRELLO_KEY e TRELLO_TOKEN nas configuracoes do repositorio.');
  }
  if (r.status === 429) { throw new Error('O Trello pediu para esperar. Rode de novo em um minuto.'); }
  if (!r.ok) { throw new Error('O Trello respondeu ' + r.status + '.'); }
  return r.json();
}

async function obterDados() {
  if (!CHAVE || !TOKEN) {
    throw new Error('Faltam os segredos TRELLO_KEY e TRELLO_TOKEN.');
  }
  var base = '/boards/' + QUADRO;
  return normalizar(
    await chamar(base + '/lists', { fields: 'name,pos', filter: 'open' }),
    await chamar(base + '/cards', { filter: 'open',
      fields: 'name,due,start,idList,idMembers,idShort,dateLastActivity' }),
    await chamar(base + '/members', { fields: 'fullName,username,initials', filter: 'all' }));
}

function titulo(t) {
  return t.toLowerCase()
    .replace(/(^|[\s|])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })
    .replace(/\s(De|Da|Do|Das|Dos|E)\s/g, function (m) { return m.toLowerCase(); });
}

// Compara nomes de coluna sem se importar com acento, caixa ou espaco sobrando:
// 'ESTRATÉGICOS', 'Estrategicos' e ' estratégicos ' viram a mesma chave.
function chave(t) {
  return String(t).trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizar(listas, cards, membros) {
  var excl = COLUNAS_EXCLUIDAS.map(chave);
  var colunas = listas
    .filter(function (l) { return excl.indexOf(chave(l.name)) === -1; })
    .map(function (l) {
      var n = l.name.trim();
      return { id: l.id, nome: n === n.toUpperCase() ? titulo(n) : n };
    });
  var validas = colunas.map(function (c) { return c.id; });

  var pessoas = {}, sobra = 0;
  membros.slice().sort(function (a, b) {
    return (a.username || '').localeCompare(b.username || '');
  }).forEach(function (m) {
    var cor = CORES_FIXAS[m.username] || PALETA[sobra++ % PALETA.length];
    var inteiro = (m.fullName || m.username || '?').trim().split(/\s+/)[0];
    pessoas[m.id] = {
      nome: inteiro.charAt(0).toUpperCase() + inteiro.slice(1),
      ini: (m.initials || '?').substring(0, 2),
      cor: cor
    };
  });

  var lista = cards.filter(function (c) {
    return validas.indexOf(c.idList) > -1;
  }).map(function (c) {
    return {
      id: c.id, nome: c.name, num: c.idShort, lista: c.idList,
      due: c.due, start: c.start, atividade: c.dateLastActivity,
      membros: (c.idMembers || []).filter(function (i) { return !!pessoas[i]; })
    };
  });

  var corte = Date.now() - 30 * 86400000;
  var indicadores = INDICADORES.map(function (nome) {
    var alvo = chave(nome);
    var achada = null;
    listas.forEach(function (l) {
      if (chave(l.name) === alvo) { achada = l; }
    });
    if (!achada) { return null; }
    var meus = cards.filter(function (c) { return c.idList === achada.id; });
    return {
      nome: titulo(achada.name.trim()),
      total: meus.length,
      recentes: meus.filter(function (c) {
        return new Date(c.dateLastActivity).getTime() > corte;
      }).length
    };
  }).filter(function (x) { return !!x; });

  return { colunas: colunas, membros: pessoas, cards: lista, indicadores: indicadores,
           meses: MESES_PARA_TRAS, titulo: TITULO, pode_atualizar: false };
}


/* -------------------------------------------------------------- pagina --- */

function montarPagina(dados) {
  if (!MOSTRAR_TITULOS) {
    dados.cards.forEach(function (c) { c.nome = 'Card #' + c.num; });
  }

  var grafico = montar(dados, new Date());

  // O "atualizar" aqui e disparar o workflow no GitHub.
  var repo = process.env.GITHUB_REPOSITORY;
  if (repo) {
    grafico = grafico.replace(
      '<button type="button" class="imds-ord" data-o="quadro">Ordenar por prazo</button>',
      '<button type="button" class="imds-ord" data-o="quadro">Ordenar por prazo</button>'
      + '<a class="imds-atualizar" target="_blank" rel="noopener" href="https://github.com/'
      + repo + '/actions">Atualizar agora</a>');
  }

  var cores = {};
  for (var id in dados.membros) { cores[id] = dados.membros[id].cor; }
  var escuro = TEMA === 'escuro';

  return '<!doctype html>\n<html lang="pt-BR">\n<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<meta name="robots" content="noindex, nofollow">\n'
    + '<title>Gantt Marketing IMendes</title>\n'
    + '<style>' + ESTILO + '</style>\n</head>\n'
    + '<body style="margin:0;background:' + (escuro ? '#13162C' : '#F1F1EF') + '">\n'
    + '<div class="imds-gantt imds-' + (escuro ? 'escuro' : 'claro') + '">' + grafico + '</div>\n'
    + '<script>var CORES=' + JSON.stringify(cores) + ';'
    + 'function carregar(){location.reload();}'
    + LIGAR + '\nligar(document,{membros:' + JSON.stringify(dados.membros) + '});'
    + '<' + '/script>\n</body>\n</html>\n';
}

/* ------------------------------------------- nucleo compartilhado -------- */

var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
	'jul', 'ago', 'set', 'out', 'nov', 'dez'];
var DIA = 86400000;

function esc(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A data de criacao vive nos 8 primeiros digitos do id do card. */
function criadoEm(id) {
	return new Date(parseInt(String(id).substring(0, 8), 16) * 1000);
}

function data(v) {
	return v ? new Date(v) : null;
}

function num(n) {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function br(d) {
	return ('0' + d.getDate()).slice(-2) + '/' +
		('0' + (d.getMonth() + 1)).slice(-2) + '/' +
		String(d.getFullYear()).slice(2);
}

function preparar(dados, hoje) {
	return dados.cards.map(function (c) {
		var iniReal = data(c.start);
		var fimReal = data(c.due);
		var ini = iniReal || criadoEm(c.id);
		var fim = fimReal || data(c.atividade) || ini;
		if (fim < ini) { fim = ini; }
		return {
			card: c, ini: ini, fim: fim, iniReal: iniReal, fimReal: fimReal,
			planejado: !!fimReal,
			atrasado: !!(fimReal && fimReal < hoje),
			membros: (c.membros || [])
		};
	});
}

function janela(linhas, meses, hoje) {
	var piso = new Date(hoje.getTime() - meses * 30 * DIA);
	var minIni = linhas.reduce(function (a, l) {
		return l.ini < a ? l.ini : a;
	}, hoje);
	var maxFim = linhas.reduce(function (a, l) {
		return l.fim > a ? l.fim : a;
	}, new Date(hoje.getTime() + 30 * DIA));
	var a = new Date(Math.max(minIni.getTime(), piso.getTime()));
	a = new Date(a.getFullYear(), a.getMonth(), 1);
	var b = new Date(maxFim.getFullYear(), maxFim.getMonth() + 1, 1);
	return [a, b];
}

function montar(dados, hoje) {
	var linhas = preparar(dados, hoje);
	if (!linhas.length) {
		return '<p class="imds-vazio">Nenhum card aberto nas colunas escolhidas.</p>';
	}

	var jan = janela(linhas, dados.meses || 12, hoje);
	var A = jan[0], B = jan[1], vao = B - A;
	function pct(d) {
		return Math.max(0, Math.min(100, (d - A) / vao * 100));
	}

	var meses = [], quinzenas = [];
	var y = A.getFullYear(), m = A.getMonth();
	while (y < B.getFullYear() || (y === B.getFullYear() && m < B.getMonth())) {
		var ini = new Date(y, m, 1), meio = new Date(y, m, 16), prox = new Date(y, m + 1, 1);
		meses.push({ ini: ini, fim: prox, nome: MES[m], ano: y, alt: meses.length % 2 === 1 });
		// Duas quinzenas por mes, dia 1 e dia 16, para o sprint nunca cruzar o mes.
		quinzenas.push({ ini: ini, fim: meio, dia: 1 });
		quinzenas.push({ ini: meio, fim: prox, dia: 16 });
		if (m === 11) { y++; m = 0; } else { m++; }
	}

	var grade = '<div class="imds-grade">'
		+ meses.map(function (x) {
			return '<div class="imds-banda' + (x.alt ? ' imds-alt' : '') + '" style="left:'
				+ pct(x.ini).toFixed(4) + '%;width:'
				+ (pct(x.fim) - pct(x.ini)).toFixed(4) + '%"></div>';
		}).join('')
		+ quinzenas.filter(function (q) { return q.dia === 16; }).map(function (q) {
			return '<div class="imds-quinzena" style="left:' + pct(q.ini).toFixed(4) + '%"></div>';
		}).join('')
		+ '<div class="imds-hoje" style="left:' + pct(hoje).toFixed(4) + '%"></div></div>';

	var porLista = {};
	linhas.forEach(function (l) {
		(porLista[l.card.lista] = porLista[l.card.lista] || []).push(l);
	});

	var carga = {};
	linhas.forEach(function (l) {
		l.membros.forEach(function (id) { carga[id] = (carga[id] || 0) + 1; });
	});
	var ordem = Object.keys(carga).sort(function (a, b) { return carga[b] - carga[a]; });

	var comPrazo = linhas.filter(function (l) { return l.planejado; }).length;
	var vencidos = linhas.filter(function (l) { return l.atrasado; }).length;
	var semDono = linhas.filter(function (l) { return !l.membros.length; }).length;
	var colsUsadas = dados.colunas.filter(function (c) {
		return (porLista[c.id] || []).length;
	});

	var h = [];
	h.push('<div class="imds-topo">');
	h.push('<svg class="imds-aneis" width="46" height="46" viewBox="0 0 52 52" aria-hidden="true">' +
		'<circle cx="26" cy="26" r="24" fill="none" stroke="#2A3059" stroke-width="2"/>' +
		'<circle cx="26" cy="26" r="17" fill="none" stroke="#2A3059" stroke-width="2"/>' +
		'<circle cx="26" cy="26" r="10" fill="none" stroke="#EABD32" stroke-width="2"/>' +
		'<circle cx="26" cy="26" r="3.2" fill="#EABD32"/></svg>');
	h.push('<div><h2 class="imds-h">' + esc(dados.titulo || '') + '</h2>');
	h.push('<p class="imds-sub">Cada linha resume uma pessoa, com os cards dela ' +
		'sobrepostos e as pontas marcando inicio e fim. Clique na linha para abrir card ' +
		'a card. A cor cheia marca o periodo com data no Trello; a listrada e o tempo de ' +
		'vida do card, usada quando nao ha prazo cadastrado.</p>');
	h.push('<div class="imds-stats">' +
		'<div class="imds-stat"><b>' + linhas.length + '</b><span>cards ativos</span></div>' +
		'<div class="imds-stat"><b>' + colsUsadas.length + '</b><span>colunas</span></div>' +
		'<div class="imds-stat"><b>' + comPrazo + '</b><span>com prazo definido</span></div>' +
		'<div class="imds-stat imds-alerta"><b>' + vencidos + '</b><span>com prazo vencido</span></div>' +
		'<div class="imds-stat"><b>' + semDono + '</b><span>sem responsavel</span></div>' +
		'</div></div></div>');

	var fora = dados.indicadores || [];
if (fora.length) {
	h.push('<div class="imds-fora"><span class="imds-fora-rot">Fora do grafico</span>'
		+ '<div class="imds-caixas">');
	fora.forEach(function (i) {
		h.push('<div class="imds-caixa"><b>' + num(i.total) + '</b>'
			+ '<span class="imds-caixa-n">' + esc(i.nome) + '</span>'
			+ '<span class="imds-caixa-s">' + num(i.recentes) + ' movimentado'
			+ (i.recentes === 1 ? '' : 's') + ' em 30 dias</span></div>');
	});
	h.push('</div></div>');
}

h.push('<div class="imds-barra"><span class="imds-rot">Filtrar por responsavel</span>');
	h.push('<button type="button" data-f="all" aria-pressed="true">Todos</button>');
	ordem.forEach(function (id) {
		var p = dados.membros[id];
		if (!p) { return; }
		h.push('<button type="button" data-f="' + esc(id) + '" aria-pressed="false" ' +
			'style="--imds-c:' + esc(p.cor) + '"><span class="imds-dot"></span>' +
			esc(p.nome) + '<span class="imds-n">' + carga[id] + '</span></button>');
	});
	h.push('<button type="button" data-f="none" aria-pressed="false">' +
		'<span class="imds-dot" style="--imds-c:#3C4680"></span>Sem responsavel' +
		'<span class="imds-n">' + semDono + '</span></button>');
	h.push('<span class="imds-espaco"></span>');
	h.push('<span class="imds-ts">Dados de ' + br(hoje) + ' as ' +
		('0' + hoje.getHours()).slice(-2) + ':' + ('0' + hoje.getMinutes()).slice(-2) + '</span>');
	h.push('<button type="button" class="imds-tudo" data-a="0">Expandir tudo</button>');
	h.push('<button type="button" class="imds-ord" data-o="quadro">Ordenar por prazo</button>');
	if (dados.pode_atualizar) {
		h.push('<button type="button" class="imds-up imds-primario">Atualizar agora</button>');
	}
	h.push('<p class="imds-msg"></p></div>');

	h.push('<div class="imds-quadro"><div class="imds-scroll"><div class="imds-interno">');
	h.push('<div class="imds-cab"><div class="imds-nome">Coluna e card</div><div class="imds-trilha">');
	meses.forEach(function (x, i) {
		var mostraAno = i === 0 || x.ini.getMonth() === 0;
		h.push('<div class="imds-eixo-mes" style="left:' + pct(x.ini).toFixed(4) + '%;width:'
			+ (pct(x.fim) - pct(x.ini)).toFixed(4) + '%">' + x.nome
			+ (mostraAno ? '<span class="imds-ano">' + String(x.ano).slice(2) + '</span>' : '')
			+ '</div>');
	});
	quinzenas.forEach(function (q) {
		h.push('<div class="imds-eixo-dia' + (q.dia === 1 ? ' imds-q1' : '') + '" style="left:'
			+ pct(q.ini).toFixed(4) + '%;width:'
			+ (pct(q.fim) - pct(q.ini)).toFixed(4) + '%">' + q.dia + '</div>');
	});
	h.push('<div class="imds-hoje" style="left:' + pct(hoje).toFixed(4) + '%"></div></div></div>');

	dados.colunas.forEach(function (col) {
		var rs = porLista[col.id] || [];
		if (!rs.length) { return; }
		var venc = rs.filter(function (r) { return r.atrasado; }).length;
		var comPrazoAqui = rs.filter(function (r) { return r.planejado; }).length;
		var iniGeral = rs[0].ini, fimGeral = rs[0].fim;
		rs.forEach(function (r) {
			if (r.ini < iniGeral) { iniGeral = r.ini; }
			if (r.fim > fimGeral) { fimGeral = r.fim; }
		});

		h.push('<div class="imds-faixa" data-lane="' + esc(col.id) + '" data-aberta="0">');
		h.push('<div class="imds-nome">'
			+ '<button type="button" class="imds-toggle" aria-expanded="false"'
			+ ' aria-label="Expandir ' + esc(col.nome) + '"><span class="imds-seta"></span></button>'
			+ '<span class="imds-fn">' + esc(col.nome) + '</span>'
			+ '<span class="imds-fc">' + rs.length + ' card' + (rs.length > 1 ? 's' : '')
			+ (comPrazoAqui ? ' &middot; ' + comPrazoAqui + ' com prazo' : '')
			+ (venc ? ' &middot; <b class="imds-venc">' + venc + ' vencido'
				+ (venc > 1 ? 's' : '') + '</b>' : '')
			+ '</span></div>');

		// Todas as barras da pessoa empilhadas na mesma altura: onde elas se
		// cruzam a cor adensa, e as pontas marcam inicio e fim de cada card.
		h.push('<div class="imds-trilha">' + grade);
		h.push('<div class="imds-envelope" style="left:' + pct(iniGeral).toFixed(4)
			+ '%;width:' + Math.max(0.4, pct(fimGeral) - pct(iniGeral)).toFixed(4) + '%"></div>');
		rs.forEach(function (r) {
			var e = pct(r.ini), w = Math.max(0.4, pct(r.fim) - e);
			h.push('<div class="imds-mini' + (r.planejado ? ' imds-plan' : '')
				+ '" data-membros="' + esc(r.membros.join(' ')) + '" style="left:' + e.toFixed(4)
				+ '%;width:' + w.toFixed(4) + '%" title="' + esc(r.card.nome + ' — '
				+ br(r.ini) + ' a ' + br(r.fim)) + '"></div>');
		});
		rs.forEach(function (r) {
			if (!r.fimReal) { return; }
			h.push('<div class="imds-prazo' + (r.atrasado ? ' imds-tarde' : '')
				+ '" style="left:' + pct(r.fimReal).toFixed(4) + '%" title="'
				+ esc(r.card.nome + ' — entrega ' + br(r.fimReal)) + '"></div>');
		});
		h.push('</div></div>');

		rs.forEach(function (r, i) {
			var c = r.card;
			var esqui = pct(r.ini);
			var larg = Math.max(0.35, pct(r.fim) - esqui);
			var cls = 'imds-bar ' + (r.planejado ? 'imds-plan' : 'imds-infer') +
				(r.ini < A ? ' imds-corte' : '');

			var dica = c.nome + ' — #' + c.num + '\n' +
				(r.iniReal ? 'Inicio: ' + br(r.iniReal) + ' (Trello)'
					: 'Criado em ' + br(r.ini)) + '\n' +
				(r.fimReal ? 'Entrega: ' + br(r.fimReal) + (r.atrasado ? ' — vencido' : '')
					: 'Ultima movimentacao: ' + br(r.fim) + ' — sem prazo') + '\n' +
				(r.membros.length
					? r.membros.map(function (id) {
						return (dados.membros[id] || {}).nome || '?';
					}).join(', ')
					: 'Sem responsavel');

			h.push('<div class="imds-linha imds-filha" data-lane="' + esc(col.id)
				+ '" data-membros="' + esc(r.membros.join(' ')) +
				'" data-fim="' + (r.fimReal || r.fim).toISOString() + '" data-ord="' + i + '">');
			h.push('<div class="imds-nome"><span class="imds-txt" title="' + esc(c.nome) +
				'">' + esc(c.nome) + '</span><span class="imds-chips">');
			if (r.membros.length) {
				r.membros.forEach(function (id) {
					var p = dados.membros[id] || { cor: '#7A839E', ini: '?', nome: '?' };
					h.push('<span class="imds-chip" style="--imds-c:' + esc(p.cor) +
						'" title="' + esc(p.nome) + '">' + esc(p.ini) + '</span>');
				});
			} else {
				h.push('<span class="imds-chip imds-vazio">&ndash;</span>');
			}
			h.push('</span></div><div class="imds-trilha">' + grade);
			h.push('<div class="' + cls + '" style="left:' + esqui.toFixed(4) +
				'%;width:' + larg.toFixed(4) + '%" title="' + esc(dica) + '"></div>');
			if (r.fimReal) {
				h.push('<div class="imds-prazo' + (r.atrasado ? ' imds-tarde' : '') +
					'" style="left:' + pct(r.fimReal).toFixed(4) + '%" title="' +
					esc(dica) + '"></div>');
			}
			h.push('</div></div>');
		});
	});
	h.push('</div></div></div>');

	h.push('<div class="imds-legenda">' +
		'<span><i class="imds-k-mini"></i>resumo: um card, com inicio e fim</span>' +
		'<span><i class="imds-k-plan"></i>periodo com data no Trello</span>' +
		'<span><i class="imds-k-inf"></i>criacao &rarr; ultima movimentacao</span>' +
		'<span><i class="imds-k-prazo"></i>data de entrega</span>' +
		'<span><i class="imds-k-tarde"></i>entrega vencida</span>' +
		'<span><i class="imds-k-quinzena"></i>quinzena, dia 1 e dia 16</span>' +
		'<span><i class="imds-k-hoje"></i>hoje</span></div>');

	return h.join('');
}

/* ------------------------------ estilo e script do navegador ------------ */

var ESTILO = "/* Gantt Marketing IMendes.\n   Tudo com prefixo .imds- para nao colidir com o tema do site.\n   As cores vivem em variaveis: .imds-claro e .imds-escuro trocam o conjunto. */\n\n.imds-gantt{\n  --imds-col:340px;\n  background:var(--imds-fundo); color:var(--imds-texto);\n  font-family:Poppins,Inter,system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;\n  font-size:14px; line-height:1.45; padding:24px 20px 28px;\n  border-radius:12px; overflow:hidden;\n}\n\n/* --- tema claro: cinza suave, informacao em alto contraste ---------------- */\n.imds-gantt.imds-claro{\n  --imds-fundo:#F1F1EF;\n  --imds-painel:#FFFFFF;\n  --imds-painel2:#F7F7F5;\n  --imds-faixa:#E9E9E5;\n  --imds-linha:#DEDEDA;\n  --imds-linha-forte:#94948D;\n  --imds-quinzena:#B4B4AD;\n  --imds-texto:#1E212B;\n  --imds-mudo:#63687A;\n  --imds-ouro:#B07F09;\n  --imds-ouro-cheio:#EABD32;\n  --imds-vermelho:#C0392B;\n  --imds-bar-plan:#4A5474;\n  --imds-bar-a:#8D929E;\n  --imds-bar-b:#A6AAB5;\n  --imds-banda:rgba(30,33,43,.028);\n  --imds-hover:#F4F4F1;\n  --imds-sel:#E4E6EF;\n  --imds-sel-borda:#9AA0B8;\n  --imds-escurece:#2B2E38;\n  --imds-chip-texto:#15171E;\n  --imds-contorno:rgba(30,33,43,.45);\n}\n\n/* --- tema escuro: o navy original ---------------------------------------- */\n.imds-gantt.imds-escuro{\n  --imds-fundo:#13162C;\n  --imds-painel:#191D38;\n  --imds-painel2:#1F2444;\n  --imds-faixa:#151934;\n  --imds-linha:#2A3059;\n  --imds-linha-forte:#3C4680;\n  --imds-quinzena:#333A63;\n  --imds-texto:#F3F3EF;\n  --imds-mudo:#8E96B4;\n  --imds-ouro:#EABD32;\n  --imds-ouro-cheio:#EABD32;\n  --imds-vermelho:#FF5A5A;\n  --imds-bar-plan:#55639E;\n  --imds-bar-a:#333A63;\n  --imds-bar-b:#2C3358;\n  --imds-banda:rgba(255,255,255,.022);\n  --imds-hover:#1C2140;\n  --imds-sel:#2C3364;\n  --imds-sel-borda:#4A5596;\n  --imds-escurece:#191D38;\n  --imds-chip-texto:#13162C;\n  --imds-contorno:transparent;\n}\n\n.imds-gantt *{box-sizing:border-box}\n.imds-gantt p{margin:0}\n\n.imds-carregando,.imds-erro,.imds-vazio{\n  color:var(--imds-mudo); font-size:13px; padding:20px 0; text-align:center}\n.imds-erro{color:var(--imds-vermelho)}\n\n/* --- cabecalho ----------------------------------------------------------- */\n.imds-topo{display:flex; gap:18px; align-items:flex-start; margin-bottom:20px}\n.imds-aneis{flex:0 0 auto; margin-top:2px}\n.imds-gantt .imds-h{\n  font-weight:800; font-size:27px; line-height:1.08; letter-spacing:-.01em;\n  margin:0 0 6px; color:var(--imds-texto); padding:0; border:0}\n.imds-sub{color:var(--imds-mudo); max-width:64ch; font-size:13.5px}\n.imds-stats{display:flex; flex-wrap:wrap; gap:20px; margin-top:14px}\n.imds-stat b{font-weight:800; font-size:21px; display:block; line-height:1}\n.imds-stat span{color:var(--imds-mudo); font-size:12px}\n.imds-alerta b{color:var(--imds-vermelho)}\n\n/* --- caixas das colunas fora do grafico ---------------------------------- */\n.imds-fora{display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-bottom:9px}\n.imds-fora-rot{font-size:12px; font-weight:600; color:var(--imds-mudo); letter-spacing:.02em}\n.imds-caixas{display:flex; flex-wrap:wrap; gap:10px}\n.imds-caixa{background:var(--imds-painel); border:1px solid var(--imds-linha);\n  border-left:3px solid var(--imds-linha-forte); border-radius:9px;\n  padding:10px 15px 11px; min-width:152px; display:flex; flex-direction:column; gap:1px}\n.imds-caixa b{font-weight:800; font-size:23px; line-height:1.05}\n.imds-caixa-n{font-size:12.5px; color:var(--imds-texto)}\n.imds-caixa-s{font-size:11.5px; color:var(--imds-mudo)}\n\n/* --- barra de controles -------------------------------------------------- */\n.imds-barra{display:flex; flex-wrap:wrap; gap:9px; align-items:center;\n  padding:13px 15px; background:var(--imds-painel);\n  border:1px solid var(--imds-linha); border-radius:10px}\n.imds-rot{font-size:12px; font-weight:600; color:var(--imds-mudo); margin-right:6px}\n.imds-gantt button{\n  font:inherit; font-size:13px; color:var(--imds-texto);\n  background:var(--imds-painel2); border:1px solid var(--imds-linha);\n  border-radius:999px; padding:5px 13px; cursor:pointer; line-height:1.4;\n  display:inline-flex; align-items:center; gap:7px; text-transform:none;\n  letter-spacing:normal; box-shadow:none; margin:0; min-height:0; width:auto;\n  transition:border-color .12s, background .12s}\n.imds-gantt button:hover{background:var(--imds-painel2);\n  border-color:var(--imds-linha-forte); color:var(--imds-texto)}\n.imds-gantt button:focus-visible{outline:2px solid var(--imds-ouro); outline-offset:2px}\n.imds-gantt button[aria-pressed=\"true\"]{background:var(--imds-sel);\n  border-color:var(--imds-sel-borda)}\n.imds-dot{width:9px; height:9px; border-radius:50%; background:var(--imds-c,#7A839E);\n  box-shadow:0 0 0 1px var(--imds-contorno)}\n.imds-n{color:var(--imds-mudo); font-size:12px}\n.imds-gantt button[aria-pressed=\"true\"] .imds-n{color:var(--imds-texto)}\n.imds-espaco{flex:1}\n.imds-ts{color:var(--imds-mudo); font-size:12px}\n.imds-gantt .imds-atualizar{\n  background:var(--imds-ouro-cheio); border:1px solid #C9A02A; color:#15171E;\n  font-weight:600; font-size:13px; border-radius:999px; padding:5px 13px;\n  text-decoration:none; line-height:1.4; display:inline-flex; align-items:center}\n.imds-gantt .imds-atualizar:hover{background:#F2CB55; color:#15171E}\n.imds-gantt .imds-atualizar:focus-visible{outline:2px solid var(--imds-texto); outline-offset:2px}\n\n/* --- moldura do grafico -------------------------------------------------- */\n.imds-quadro{border:1px solid var(--imds-linha); border-radius:10px;\n  overflow:hidden; background:var(--imds-painel); margin-top:13px}\n.imds-scroll{overflow-x:auto; -webkit-overflow-scrolling:touch}\n.imds-interno{min-width:1180px}\n.imds-cab{display:flex; background:var(--imds-painel2);\n  border-bottom:1px solid var(--imds-linha-forte)}\n.imds-cab .imds-nome{width:var(--imds-col); flex:0 0 var(--imds-col);\n  padding:9px 14px; font-size:12px; color:var(--imds-mudo);\n  border-right:1px solid var(--imds-linha)}\n.imds-trilha{flex:1; position:relative; min-height:34px}\n.imds-cab .imds-trilha{height:54px}\n\n/* eixo: mes em cima, quinzena embaixo */\n.imds-eixo-mes{position:absolute; top:0; height:32px;\n  border-left:1px solid var(--imds-linha-forte);\n  font-size:11.5px; font-weight:600; color:var(--imds-texto);\n  padding:9px 0 0 7px; white-space:nowrap; overflow:hidden}\n.imds-ano{color:var(--imds-mudo); font-weight:400; margin-left:3px}\n.imds-eixo-dia{position:absolute; top:32px; height:22px;\n  font-size:10px; color:var(--imds-mudo); padding:5px 0 0 5px;\n  white-space:nowrap; overflow:hidden;\n  border-left:1px dashed var(--imds-quinzena); border-top:1px solid var(--imds-linha)}\n.imds-eixo-dia.imds-q1{border-left:1px solid var(--imds-linha-forte);\n  color:var(--imds-texto); font-weight:600}\n\n/* --- faixas e linhas ----------------------------------------------------- */\n/* faixa = linha-resumo da pessoa, com todos os cards sobrepostos */\n.imds-faixa{display:flex; align-items:stretch;\n  background:var(--imds-faixa); border-top:1px solid var(--imds-linha-forte);\n  border-bottom:1px solid var(--imds-linha); cursor:pointer}\n.imds-faixa:hover{background:var(--imds-hover)}\n.imds-faixa .imds-nome{width:var(--imds-col); flex:0 0 var(--imds-col);\n  padding:8px 12px; border-right:1px solid var(--imds-linha);\n  display:flex; align-items:center; gap:9px; min-height:44px}\n.imds-gantt button.imds-toggle{\n  flex:0 0 auto; width:20px; height:20px; padding:0; border-radius:5px;\n  background:transparent; border:1px solid var(--imds-linha-forte);\n  color:var(--imds-mudo); justify-content:center}\n.imds-gantt button.imds-toggle:hover{background:var(--imds-painel);\n  color:var(--imds-texto)}\n.imds-seta{width:0; height:0; border-left:5px solid currentColor;\n  border-top:4px solid transparent; border-bottom:4px solid transparent;\n  transition:transform .15s; margin-left:1px}\n.imds-faixa[data-aberta=\"1\"] .imds-seta{transform:rotate(90deg)}\n.imds-fn{font-weight:600; font-size:13.5px; white-space:nowrap;\n  overflow:hidden; text-overflow:ellipsis}\n.imds-fc{color:var(--imds-mudo); font-size:11px; white-space:nowrap; margin-left:auto}\n.imds-venc{color:var(--imds-vermelho); font-weight:700}\n\n/* envelope: do primeiro inicio ao ultimo fim da pessoa */\n.imds-envelope{position:absolute; top:50%; transform:translateY(-50%); height:22px;\n  border-radius:5px; background:var(--imds-banda); border:1px solid var(--imds-linha)}\n/* cada card do resumo: preenchimento translucido, pontas solidas */\n.imds-mini{position:absolute; top:50%; transform:translateY(-50%); height:10px;\n  border-radius:2px; min-width:4px; box-sizing:border-box;\n  background:color-mix(in srgb, var(--imds-bar-a) 50%, transparent);\n  border-left:2px solid var(--imds-bar-a);\n  border-right:2px solid var(--imds-bar-a);\n  transition:opacity .15s}\n.imds-mini.imds-plan{\n  background:color-mix(in srgb, var(--imds-bar-plan) 42%, transparent);\n  border-left-color:var(--imds-bar-plan); border-right-color:var(--imds-bar-plan)}\n.imds-mini.imds-mini-apaga{opacity:.1}\n\n.imds-linha{display:flex; align-items:stretch; border-top:1px solid var(--imds-linha)}\n.imds-filha .imds-nome{border-left:3px solid var(--imds-linha)}\n.imds-linha:hover{background:var(--imds-hover)}\n.imds-linha .imds-nome{width:var(--imds-col); flex:0 0 var(--imds-col);\n  padding:6px 12px 6px 41px; border-right:1px solid var(--imds-linha);\n  display:flex; align-items:center; gap:8px; min-height:34px}\n.imds-txt{flex:1; min-width:0; font-size:12.5px; white-space:nowrap;\n  overflow:hidden; text-overflow:ellipsis}\n.imds-chips{display:flex; gap:3px; flex:0 0 auto}\n.imds-chip{width:19px; height:19px; border-radius:50%;\n  background:var(--imds-c); color:var(--imds-chip-texto); font-size:9.5px;\n  font-weight:700; display:inline-flex; align-items:center; justify-content:center;\n  box-shadow:0 0 0 1px var(--imds-contorno)}\n.imds-chip.imds-vazio{background:transparent; box-shadow:none;\n  border:1px dashed var(--imds-linha-forte); color:var(--imds-mudo)}\n\n/* --- grade: banda por mes, divisao por quinzena -------------------------- */\n.imds-grade{position:absolute; inset:0; pointer-events:none}\n.imds-banda{position:absolute; top:0; bottom:0;\n  border-left:1px solid var(--imds-linha-forte)}\n.imds-banda.imds-alt{background:var(--imds-banda)}\n.imds-quinzena{position:absolute; top:0; bottom:0; width:0;\n  border-left:1px dashed var(--imds-quinzena)}\n.imds-hoje{position:absolute; top:0; bottom:0; width:2px; margin-left:-1px;\n  background:var(--imds-ouro); z-index:3}\n\n/* --- barras -------------------------------------------------------------- */\n.imds-bar{position:absolute; top:50%; transform:translateY(-50%); height:11px;\n  border-radius:3px; background:var(--imds-bar-a); min-width:3px;\n  transition:opacity .15s, background .15s}\n.imds-bar.imds-plan{background:var(--imds-bar-plan)}\n.imds-bar.imds-infer{background:repeating-linear-gradient(115deg,\n  var(--imds-bar-a) 0 5px, var(--imds-bar-b) 5px 10px)}\n.imds-bar.imds-corte{border-top-left-radius:0; border-bottom-left-radius:0;\n  border-left:2px solid var(--imds-mudo)}\n.imds-prazo{position:absolute; top:50%; width:10px; height:10px; margin-left:-5px;\n  transform:translateY(-50%) rotate(45deg); background:var(--imds-ouro-cheio);\n  z-index:4; border-radius:1px; box-shadow:0 0 0 1px var(--imds-contorno)}\n.imds-prazo.imds-tarde{background:var(--imds-vermelho); box-shadow:none}\n.imds-linha.imds-apaga .imds-bar{opacity:.12}\n.imds-linha.imds-apaga .imds-prazo{opacity:.15}\n.imds-linha.imds-apaga .imds-nome{opacity:.34}\n.imds-linha.imds-acende .imds-bar{\n  background:color-mix(in srgb, var(--imds-hi) 78%, var(--imds-escurece))}\n.imds-linha.imds-acende .imds-bar.imds-infer{\n  background:repeating-linear-gradient(115deg,\n    color-mix(in srgb, var(--imds-hi) 78%, var(--imds-escurece)) 0 5px,\n    color-mix(in srgb, var(--imds-hi) 42%, var(--imds-escurece)) 5px 10px)}\n\n/* --- legenda ------------------------------------------------------------- */\n.imds-legenda{display:flex; flex-wrap:wrap; gap:16px; color:var(--imds-mudo);\n  font-size:12px; margin-top:14px; align-items:center}\n.imds-legenda i{display:inline-block; vertical-align:middle; margin-right:6px}\n.imds-k-plan{width:26px; height:9px; border-radius:3px; background:var(--imds-bar-plan)}\n.imds-k-inf{width:26px; height:9px; border-radius:3px;\n  background:repeating-linear-gradient(115deg,\n  var(--imds-bar-a) 0 5px, var(--imds-bar-b) 5px 10px)}\n.imds-k-prazo{width:9px; height:9px; background:var(--imds-ouro-cheio);\n  transform:rotate(45deg); border-radius:1px; box-shadow:0 0 0 1px var(--imds-contorno)}\n.imds-k-tarde{width:9px; height:9px; background:var(--imds-vermelho);\n  transform:rotate(45deg); border-radius:1px}\n.imds-k-hoje{width:2px; height:14px; background:var(--imds-ouro)}\n.imds-k-quinzena{width:0; height:14px; border-left:1px dashed var(--imds-linha-forte)}\n.imds-k-mini{width:26px; height:10px; border-radius:2px; box-sizing:border-box;\n  background:color-mix(in srgb, var(--imds-bar-plan) 42%, transparent);\n  border-left:2px solid var(--imds-bar-plan); border-right:2px solid var(--imds-bar-plan)}\n\n@media (max-width:782px){\n  .imds-fc{display:none}\n  .imds-gantt{--imds-col:180px; padding:18px 14px 22px}\n  .imds-gantt .imds-h{font-size:21px}\n  .imds-txt{font-size:11.5px}\n  .imds-topo{gap:12px}\n  .imds-caixa{min-width:0; flex:1 1 45%}\n}\n@media (prefers-reduced-motion:reduce){\n  .imds-gantt *{transition:none !important; animation:none !important}\n}\n";

var LIGAR = "function ligar(raiz, dados) {\n\tvar linhas = [].slice.call(raiz.querySelectorAll('.imds-linha'));\n\tvar botoes = [].slice.call(raiz.querySelectorAll('button[data-f]'));\n\tvar minis = [].slice.call(raiz.querySelectorAll('.imds-mini'));\n\tvar faixas = [].slice.call(raiz.querySelectorAll('.imds-faixa'));\n\tvar filtro = 'all';\n\n\tfunction aplicar() {\n\t\tlinhas.forEach(function (l) {\n\t\t\tl.classList.remove('imds-apaga', 'imds-acende');\n\t\t\tl.style.removeProperty('--imds-hi');\n\t\t\tif (filtro === 'all') { return; }\n\t\t\tvar ms = (l.dataset.membros || '').split(' ').filter(Boolean);\n\t\t\tvar bate = filtro === 'none' ? !ms.length : ms.indexOf(filtro) > -1;\n\t\t\tif (bate) {\n\t\t\t\tl.classList.add('imds-acende');\n\t\t\t\tl.style.setProperty('--imds-hi', filtro === 'none'\n\t\t\t\t\t? '#6B76A8' : (dados.membros[filtro] || {}).cor || '#6B76A8');\n\t\t\t} else {\n\t\t\t\tl.classList.add('imds-apaga');\n\t\t\t}\n\t\t});\n\t\tminis.forEach(function (b) {\n\t\t\tb.classList.remove('imds-mini-apaga');\n\t\t\tif (filtro === 'all') { return; }\n\t\t\tvar ms = (b.dataset.membros || '').split(' ').filter(Boolean);\n\t\t\tvar bate = filtro === 'none' ? !ms.length : ms.indexOf(filtro) > -1;\n\t\t\tif (!bate) { b.classList.add('imds-mini-apaga'); }\n\t\t});\n\t\tbotoes.forEach(function (b) {\n\t\t\tb.setAttribute('aria-pressed', String(b.dataset.f === filtro));\n\t\t});\n\t}\n\n\tbotoes.forEach(function (b) {\n\t\tb.addEventListener('click', function () {\n\t\t\tfiltro = (filtro === b.dataset.f && b.dataset.f !== 'all') ? 'all' : b.dataset.f;\n\t\t\taplicar();\n\t\t});\n\t});\n\n\tfunction definir(faixa, aberta) {\n\t\tfaixa.dataset.aberta = aberta ? '1' : '0';\n\t\tvar b = faixa.querySelector('.imds-toggle');\n\t\tif (b) { b.setAttribute('aria-expanded', String(aberta)); }\n\t\tvar n = faixa.nextElementSibling;\n\t\twhile (n && n.classList.contains('imds-filha')) {\n\t\t\tn.style.display = aberta ? '' : 'none';\n\t\t\tn = n.nextElementSibling;\n\t\t}\n\t}\n\n\tfaixas.forEach(function (f) {\n\t\tdefinir(f, false);\n\t\tf.addEventListener('click', function () {\n\t\t\tdefinir(f, f.dataset.aberta !== '1');\n\t\t});\n\t});\n\n\tvar tudo = raiz.querySelector('.imds-tudo');\n\tif (tudo) {\n\t\ttudo.addEventListener('click', function () {\n\t\t\tvar abrir = tudo.dataset.a !== '1';\n\t\t\ttudo.dataset.a = abrir ? '1' : '0';\n\t\t\ttudo.textContent = abrir ? 'Recolher tudo' : 'Expandir tudo';\n\t\t\tfaixas.forEach(function (f) { definir(f, abrir); });\n\t\t});\n\t}\n\n\tvar ord = raiz.querySelector('.imds-ord');\n\tif (ord) {\n\t\tord.addEventListener('click', function () {\n\t\t\tvar porPrazo = ord.dataset.o === 'quadro';\n\t\t\tord.dataset.o = porPrazo ? 'prazo' : 'quadro';\n\t\t\tord.textContent = porPrazo ? 'Voltar a ordem do quadro' : 'Ordenar por prazo';\n\t\t\t[].slice.call(raiz.querySelectorAll('.imds-faixa')).forEach(function (faixa) {\n\t\t\t\tvar grupo = [], n = faixa.nextElementSibling;\n\t\t\t\twhile (n && n.classList.contains('imds-linha')) {\n\t\t\t\t\tgrupo.push(n); n = n.nextElementSibling;\n\t\t\t\t}\n\t\t\t\tgrupo.sort(function (a, b) {\n\t\t\t\t\treturn porPrazo\n\t\t\t\t\t\t? a.dataset.fim.localeCompare(b.dataset.fim)\n\t\t\t\t\t\t: (+a.dataset.ord) - (+b.dataset.ord);\n\t\t\t\t});\n\t\t\t\tvar ref = faixa;\n\t\t\t\tgrupo.forEach(function (l) { ref.after(l); ref = l; });\n\t\t\t});\n\t\t});\n\t}\n\n\tvar up = raiz.querySelector('.imds-up');\n\tif (up) {\n\t\tup.addEventListener('click', function () {\n\t\t\tvar msg = raiz.querySelector('.imds-msg');\n\t\t\tup.disabled = true;\n\t\t\tup.innerHTML = '<span class=\"imds-spin\"></span>Buscando no Trello';\n\t\t\tmsg.className = 'imds-msg';\n\t\t\tmsg.textContent = '';\n\t\t\tcarregar(raiz, true).catch(function (e) {\n\t\t\t\tup.disabled = false;\n\t\t\t\tup.textContent = 'Tentar de novo';\n\t\t\t\tmsg.className = 'imds-msg';\n\t\t\t\tmsg.textContent = e.message || String(e);\n\t\t\t});\n\t\t});\n\t}\n}";


/* ----------------------------------------------------------------- main -- */

(async function () {
  try {
    var dados = await obterDados();
    var pasta = path.join(__dirname, 'site');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'index.html'), montarPagina(dados), 'utf8');
    console.log(dados.cards.length + ' cards em ' + dados.colunas.length
      + ' colunas -> site/index.html');
  } catch (e) {
    console.error('\nFalhou: ' + (e.message || e) + '\n');
    process.exit(1);
  }
})();
