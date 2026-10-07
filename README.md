# Gantt do quadro Marketing IMendes

Lê o Trello e publica um mapa de entregas numa página do GitHub. Atualiza
sozinho todo dia útil às 8h, e tem um botão para atualizar na hora.

Só dois arquivos importam: `gerar.js` e `.github/workflows/gantt.yml`.

---

## Antes de começar: leia isto

**A página publicada no GitHub Pages é pública.** Qualquer pessoa com o link
abre. No plano Free o repositório também precisa ser público; com Pro ou Team
o repositório pode ser privado, mas o site continua aberto. Página com acesso
restrito só existe no plano Enterprise.

Por isso existe uma chave no `gerar.js`:

```javascript
var MOSTRAR_TITULOS = true;
```

Com `false`, os títulos dos cards viram "Card #123". As barras, os prazos, os
responsáveis e as contagens continuam idênticos — some só o texto que cita
cliente e projeto. Se o link vai circular além do time, use `false`.

A página já sai com `noindex`, então o Google não a lista. Isso não impede
quem tem o link.

---

## Parte 1 — Limpar o que existe hoje

1. **Apagar o projeto do Apps Script.** Em `script.google.com`, nos três
   pontinhos do projeto do Gantt, **Remover**. O link antigo para de funcionar.

2. **Não mexa no Power-Up da automação.** Ele fica como está.

3. **Criar um Power-Up só para o Gantt.** Em `trello.com/power-ups/admin`,
   **New**. Dê o nome **Gantt** e escolha o workspace. O campo de iframe pode
   ficar vazio.

   Isso é o que evita a confusão de antes: cada Power-Up tem chave própria, e
   o token nasce amarrado à chave. Revogar o token da automação não encosta
   mais no do Gantt, e na hora de revogar os nomes aparecem separados.

## Parte 2 — Pegar a chave e o token

No Power-Up **Gantt**, abra a aba **Trello Auth**. Em algumas versões ela
aparece como "Chave de API".

**Cuidado com a aba vizinha:** existe uma aba **OAuth 2.0**, com ID do cliente,
URL de retorno e lista de escopos. Não é essa. OAuth 2.0 serve para aplicativos
em que cada usuário faz login; o nosso roda sozinho no servidor. Não preencha
nada lá.

Na aba **Trello Auth**:

1. Clique em **Generate a new API Key** e copie o valor. É a sua `TRELLO_KEY`.
2. Para o token, em vez de clicar no link "Token" ali do lado, monte este
   endereço no navegador, trocando `SUA_CHAVE` pelo valor que acabou de copiar:

   ```
   https://trello.com/1/authorize?expiration=never&name=Gantt%20IMendes&scope=read&response_type=token&key=SUA_CHAVE
   ```

   Autorize e o Trello mostra o token na tela. Copie. É o seu `TRELLO_TOKEN`.

O `scope=read` é o motivo de montar a URL na mão: o link pronto da tela gera um
token com permissão de escrita, e o Gantt só precisa ler. Se esse token algum
dia vazar, ninguém consegue alterar nada no quadro.

O `expiration=never` evita que o gráfico pare sozinho daqui a 30 dias.

Guarde os dois num bloco de notas por enquanto.

## Parte 3 — Criar o repositório

1. Em `github.com/new`, nome `gantt-imendes`. Escolha Público ou Privado
   conforme a seção lá em cima. Marque **Add a README file** e crie.

2. Suba os arquivos desta pasta. Pelo site: **Add file → Upload files**,
   arraste `gerar.js`, confirme com **Commit changes**.

3. O workflow precisa ficar no caminho certo. Clique em **Add file → Create
   new file** e, no campo do nome, digite exatamente:

   ```
   .github/workflows/gantt.yml
   ```

   O GitHub cria as pastas conforme você digita as barras. Cole o conteúdo do
   arquivo `gantt.yml` e confirme.

## Parte 4 — Guardar as credenciais

No repositório: **Settings → Secrets and variables → Actions →
New repository secret**. Crie dois:

| Name | Secret |
|---|---|
| `TRELLO_KEY` | a chave que você copiou |
| `TRELLO_TOKEN` | o token que você copiou |

Os segredos ficam cifrados. Nem você consegue lê-los depois, e eles nunca
aparecem na página nem no log do workflow.

## Parte 5 — Ligar o Pages

**Settings → Pages → Source:** escolha **GitHub Actions**. Só isso, sem
selecionar branch.

## Parte 6 — Rodar pela primeira vez

Aba **Actions** → **Atualizar o Gantt** → **Run workflow** → botão verde
**Run workflow**.

Leva menos de um minuto. Quando a bolinha ficar verde, o endereço do site
aparece no próprio job, em "Publicar no GitHub Pages". Será algo como:

```
https://SEU-USUARIO.github.io/gantt-imendes/
```

Esse é o link do time.

---

## No dia a dia

A página se atualiza sozinha todo dia útil às 8h. Para atualizar na hora,
**Actions → Atualizar o Gantt → Run workflow** — é para lá que aponta o botão
dourado da própria página.

**Atenção:** o GitHub desliga agendamentos em repositórios sem nenhuma
atividade por 60 dias. Se o gráfico congelar, entre no Actions e rode
manualmente uma vez; isso reativa a agenda.

## Como ler a dash

Abre recolhida: uma linha por pessoa, com todos os cards dela sobrepostos.
Onde as barras se cruzam a cor adensa — é trabalho concorrendo no mesmo
período. As pontas marcam início e fim de cada card.

Clique na linha para abrir card a card. **Expandir tudo** abre todas.

No eixo, o mês fica em cima e a quinzena embaixo: dia 1 em negrito, dia 16 em
cinza, com faixas de fundo alternando por mês.

Barra cheia = tem data no Trello. Barra listrada = o card não tem prazo, então
a barra mostra da criação até a última movimentação.

## Ajustes no topo do `gerar.js`

| Variável | Para quê |
|---|---|
| `QUADRO` | Código do quadro na URL do Trello |
| `COLUNAS_EXCLUIDAS` | Colunas fora do gráfico |
| `INDICADORES` | Colunas que viram caixa de contagem no topo |
| `MESES_PARA_TRAS` | Quanto do passado o eixo mostra |
| `TITULO` | Texto do cabeçalho |
| `TEMA` | `'claro'` (cinza) ou `'escuro'` (navy) |
| `MOSTRAR_TITULOS` | `false` esconde os nomes dos cards |

Acento e maiúscula não importam nos nomes de coluna: `ESTRATÉGICOS`,
`Estrategicos` e `estratégicos` valem a mesma coisa.

Editou? Commit, e **Actions → Run workflow** para republicar.

## Se der errado

| O que aparece | O que fazer |
|---|---|
| "O Trello recusou as credenciais" | Token revogado ou colado com espaço. Gere outro pela URL da Parte 2 e atualize o segredo |
| Caiu numa tela de OAuth 2.0 | Aba errada. Volte e procure **Trello Auth** |
| "Faltam os segredos" | Parte 4 — confira se os nomes estão exatos, em maiúsculas |
| Workflow não aparece em Actions | O arquivo não está em `.github/workflows/`. Confira o caminho |
| Erro no passo "Publicar" | Parte 5 — o Source do Pages precisa ser **GitHub Actions** |
| Página 404 | Free exige repositório público. Torne público ou assine o Pro |
| Uma coluna que deveria sumir continua lá | Confira a grafia em `COLUNAS_EXCLUIDAS` |

## Rodar na sua máquina

```bash
TRELLO_KEY=sua-chave TRELLO_TOKEN=seu-token node gerar.js
```

Gera `site/index.html`, que abre com duplo clique. Precisa de Node 18 ou mais
novo. Nada para instalar além disso.
