# Orvalho — loja fictícia para aprender e-commerce na Shopify

> Projeto de estudo construído sobre a **Base Liquid**. A "Orvalho" é uma
> joalheria fictícia (diamantes cultivados, ouro reciclado, design inspirado
> na natureza) que segue o padrão de sites de joalheria premium: **marca
> primeiro, produto depois**, paleta creme + verde-floresta, títulos grandes
> com peso leve, botões em pílula e muito espaço em branco.
>
> O foco **não** é visual (imagens, fontes e cores são placeholders
> harmônicos). O foco é **funcionalidade**: como uma home de e-commerce
> funciona por dentro, do Liquid ao JavaScript, passando pela API do carrinho.

**Escopo implementado:** hero, catálogo e rodapé da página inicial.

---

## Sumário

1. [Rodando em 10 minutos](#1-rodando-em-10-minutos)
2. [Mapa dos arquivos](#2-mapa-dos-arquivos)
3. [Como o Shopify monta a home](#3-como-o-shopify-monta-a-home)
4. [Hero — animação de entrada e parallax](#4-hero--animação-de-entrada-e-parallax)
5. [Catálogo — abas, swatches e compra rápida](#5-catálogo--abas-swatches-e-compra-rápida)
6. [Rodapé — newsletter e assinatura animada](#6-rodapé--newsletter-e-assinatura-animada)
7. [Sistema de movimento](#7-sistema-de-movimento)
8. [Roteiro de testes](#8-roteiro-de-testes)
9. [Decisões e trade-offs](#9-decisões-e-trade-offs)
10. [Exercícios para praticar](#10-exercícios-para-praticar)
11. [Problemas comuns](#11-problemas-comuns)

---

## 1. Rodando em 10 minutos

### Pré-requisitos

- [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) (`shopify version` ≥ 3.x).
- Uma **development store** (grátis em [partners.shopify.com](https://partners.shopify.com)).

### Passo a passo

**1. Suba o tema em modo desenvolvimento** (preview local com hot reload):

```bash
shopify theme dev --store SUA-LOJA.myshopify.com
# abre http://127.0.0.1:9292 — cada arquivo salvo recarrega a página
```

**2. Importe os produtos de exemplo.**
Admin → **Produtos** → **Importar** → escolha [`docs/produtos-orvalho.csv`](produtos-orvalho.csv).
São 12 joias e 31 variantes, e cada uma foi pensada para testar um caso (veja o [roteiro de testes](#8-roteiro-de-testes)).

**3. Crie as coleções das abas.**
Admin → **Produtos** → **Coleções** → **Criar coleção**. Use o tipo **Automática**, com a condição
*Tipo de produto é igual a…*:

| Título da coleção | Condição | Handle gerado |
|---|---|---|
| Anéis | Tipo de produto = `Anel` | `aneis` |
| Brincos | Tipo de produto = `Brinco` | `brincos` |
| Colares | Tipo de produto = `Colar` | `colares` |

> O `templates/index.json` já aponta as abas para esses **handles**. Se você usar
> outros nomes, é só escolher a coleção certa no editor de temas.

**4. (Opcional) Ficha técnica nos cards.**
Admin → **Configurações** → **Metacampos e metaobjetos** → **Produtos** → **Adicionar definição**:
nome *Ficha técnica*, namespace e chave `custom.ficha`, tipo *Texto de linha única*.
Preencha, por exemplo, `0,5 ct · VS1 · Ouro 18k`. Sem o metacampo, o card mostra o **tipo do produto**.

**5. (Opcional) Imagens.**
Sem imagens, tudo funciona com placeholders. Para ver a **troca de imagem por
swatch**, envie uma foto por variante (na página do produto, clique na variante
e escolha a imagem dela). Bancos gratuitos ou o Magnific servem.

**6. Personalize no editor:** Admin → Loja virtual → Temas → **Personalizar**.
Todas as seções novas têm settings em português.

---

## 2. Mapa dos arquivos

### Novos

| Arquivo | O que é |
|---|---|
| [`sections/hero.liquid`](../sections/hero.liquid) | Hero com título palavra-a-palavra, ken burns, parallax, selos de confiança |
| [`sections/catalogo.liquid`](../sections/catalogo.liquid) | Seção do catálogo: título, abas (blocks), painéis, CSS do card |
| [`snippets/catalogo-painel.liquid`](../snippets/catalogo-painel.liquid) | Grade de produtos de uma aba + "Ver todas" |
| [`snippets/card-catalogo.liquid`](../snippets/card-catalogo.liquid) | Card com swatches, badges e compra rápida |
| [`assets/catalogo.js`](../assets/catalogo.js) | Web Component `<catalogo-abas>` (abas, swatches, estados do botão) |
| [`sections/rodape.liquid`](../sections/rodape.liquid) | Rodapé com newsletter, colunas, assinatura gigante animada |
| [`assets/movimento.css`](../assets/movimento.css) | Tokens de animação + padrão `[data-reveal]` |
| [`assets/movimento.js`](../assets/movimento.js) | Revelar ao rolar, parallax, "rolar para a próxima", "voltar ao topo" |
| [`locales/pt-BR.json`](../locales/pt-BR.json) | Tradução completa da loja para português |
| [`docs/produtos-orvalho.csv`](produtos-orvalho.csv) | Produtos fictícios para importar |
| [`.shopifyignore`](../.shopifyignore) | Impede que `docs/` e o README subam para a loja |

### Alterados

| Arquivo | Mudança |
|---|---|
| `templates/index.json` | Home = `hero` + `catalogo` com conteúdo da Orvalho |
| `sections/footer-group.json` | Rodapé passa a usar `rodape` (o `footer.liquid` antigo continua disponível) |
| `config/settings_data.json` | Preset **Orvalho** (paleta creme/verde, Poppins, botões pílula) ativo; preset original mantido |
| `assets/carrinho.js` | Emite eventos `carrinho:*`, anima o contador, mostra erro da API sem sair da página |
| `layout/theme.liquid` | Carrega `movimento.js` e expõe `window.themeStrings` (textos traduzidos para o JS) |
| `assets/index.css` | Importa `movimento.css` |
| `snippets/icon.liquid` | Ícones novos: entrega, folha, escudo, presente, diamante, seta, seta-cima, mais, check |
| `snippets/localization-form.liquid` | **Correção de bug**: `{% form %}` não aceita filtros nos parâmetros |
| `locales/en.default.json` | Chaves novas: `sections.hero`, `sections.catalogo`, `sections.rodape`, `cart.added_to_cart` |

---

## 3. Como o Shopify monta a home

```
layout/theme.liquid                      ← moldura: <head>, scripts, header, footer
 ├─ {% sections 'header-group' %}        → sections/nav.liquid
 ├─ {{ content_for_layout }}             ← templates/index.json decide o que entra aqui:
 │    ├─ sections/hero.liquid
 │    └─ sections/catalogo.liquid
 │         └─ snippets/catalogo-painel   (1 por aba)
 │              └─ snippets/card-catalogo (1 por produto)
 └─ {% sections 'footer-group' %}        → sections/rodape.liquid
```

Três ideias para fixar:

- **Template JSON = lista de seções + configurações.** O lojista reordena e edita
  no editor visual, e o editor grava de volta nesse JSON.
- **Section = HTML + CSS + `{% schema %}`.** O schema declara as *settings*
  (campos do editor) e os *blocks* (itens repetíveis, como as abas do catálogo).
- **Snippet = função de template.** Recebe parâmetros (`{% render 'x', a: 1 %}`)
  e não enxerga variáveis de fora, o que deixa tudo previsível.

---

## 4. Hero — animação de entrada e parallax

**Arquivo:** `sections/hero.liquid`

### O título palavra por palavra

```liquid
{%- assign palavras = block.settings.titulo | split: ' ' -%}
<h1>
  {%- for palavra in palavras -%}
    <span class="hero__palavra"><span style="--i: {{ forloop.index0 }}">{{ palavra }}</span></span>
  {%- endfor -%}
</h1>
```

- O `<span>` de fora é a **máscara** (`overflow: hidden`).
- O `<span>` de dentro começa em `translateY(105%)`, escondido abaixo da linha,
  e sobe com `animation-delay: calc(var(--d) + var(--i) * 70ms)`.
- O Liquid **escreve o índice** (`--i`) e o CSS **calcula o atraso**. Não há JS
  envolvido: a animação roda até antes do JavaScript carregar.

### A sequência dos blocos

Cada bloco recebe `--d` (o atraso), calculado pela ordem no editor. O título
"consome" meio passo por palavra, para o texto só aparecer quando as palavras
já subiram. Se você reordenar os blocos no editor, a coreografia se ajusta sozinha.

### Parallax

```html
<div class="hero__media" data-parallax="0.18">
```

O `movimento.js` lê a posição da seção a cada frame de rolagem e grava
`--parallax-y`. O CSS aplica `transform: translate3d(0, var(--parallax-y), 0)`.
A mídia é 10% mais alta que a seção, para o deslocamento nunca mostrar um "buraco".

### Sem imagem?

Aparece a **aurora**: três círculos desfocados com as cores do tema, se movendo
devagar. A seção nunca fica feia vazia, o que é ótimo para o primeiro contato no editor.

### Performance (LCP)

A imagem do hero é o maior elemento da primeira dobra. Por isso usa
`loading: 'eager'` + `fetchpriority: 'high'` e `srcset` com 6 larguras. O
navegador baixa só o tamanho necessário para a tela.

---

## 5. Catálogo — abas, swatches e compra rápida

### 5.1 Abas

Cada **block "aba"** escolhe uma coleção. O Liquid renderiza **todos os painéis**
de uma vez, deixando só o primeiro visível:

```html
<button role="tab" aria-selected="true"  aria-controls="Painel-A">Todas</button>
<button role="tab" aria-selected="false" aria-controls="Painel-B" tabindex="-1">Anéis</button>

<div role="tabpanel" id="Painel-A">…</div>
<div role="tabpanel" id="Painel-B" hidden>…</div>
```

Ao trocar de aba, o `catalogo.js` faz quatro coisas:

1. Atualiza `aria-selected` e o **roving tabindex** (só a aba ativa entra no Tab;
   as setas ← → navegam entre elas).
2. **Trava a altura** do container no tamanho do painel atual, para a página não "pular".
3. O painel atual sai (fade + sobe 8px, 200ms). Depois o novo aparece, a altura
   anima até o novo tamanho e os cards entram **em cascata**.
4. O **indicador** desliza: `translateX(offsetLeft) scaleX(offsetWidth)` num
   elemento de 1px. Animar `transform` em vez de `left`/`width` evita recálculo de layout.

### 5.2 Swatches

O card procura a primeira opção cujo nome está na setting **"Opções que viram
swatch"** (`metal, cor, color`). Para cada valor (Ouro amarelo, Ouro branco…),
o Liquid já calcula **tudo** e guarda no botão:

```html
<button data-swatch
  data-variante-id="4455…"
  data-preco="R$ 4.890,00"
  data-preco-de="R$ 5.890,00"
  data-desconto="16"
  data-disponivel="true"
  data-imagem="…/anel-rose_600x.jpg"
  data-url="/products/anel-orvalho-solitario?variant=4455…">
```

O JS só lê esses dados e troca textos. Ele **não formata dinheiro** (o Liquid já
fez isso no formato da moeda da loja) e **não chama nenhuma API**. É rápido e simples.

A cor de cada bolinha segue esta ordem:
1. **Swatch nativo do Shopify** (`valor.swatch.color`), configurado no admin quando a opção usa metacampo de categoria.
2. **Mapa da seção**, no formato `Ouro rosé: #E8B4A0`, um por linha.
3. Cinza.

A troca de imagem **pré-carrega** a nova foto (`new Image()` + `decode()`) e só
depois troca. Assim o card nunca pisca em branco. Sem foto de variante, o
fundo do card "pega" a cor do metal (`--card-tint`), então dá para testar os
swatches mesmo sem imagens.

### 5.3 Compra rápida — o fluxo completo

```
[clique em "Adicionar à sacola"]
        │  <form action="/cart/add"> nativo (funciona sem JS)
        ▼
assets/carrinho.js  ── intercepta o submit (preventDefault)
        │  dispara  carrinho:adicionando ──────────► catalogo.js: botão = "carregando" (spinner)
        │  POST /cart/add.js  (Cart AJAX API)
        │
        ├─ 200 OK ─► GET /cart.js → atualiza [data-cart-count] + animação "bump"
        │            dispara carrinho:adicionado ──► catalogo.js: botão = "sucesso ✓" (1,8s)
        │            mostrarAlerta("Adicionado à sua sacola")
        │
        ├─ 422 (ex: sem estoque) ─► dispara carrinho:erro ─► botão volta ao normal
        │                            mostrarAlerta(mensagem do Shopify, 'negativo')
        │
        └─ falha de rede ─► form.submit() (fallback: envio tradicional)
```

**Por que eventos?** O `carrinho.js` não sabe que o catálogo existe, e o catálogo
não sabe fazer requisição. Cada um tem uma responsabilidade, e os eventos ligam
os dois. Amanhã um *cart drawer* pode ouvir o mesmo `carrinho:adicionado` e abrir
sozinho, sem tocar em nenhum dos dois arquivos.

**Quando a compra rápida aparece?** Só quando **um clique basta** para definir a
variante: produto sem variantes, ou com **uma** opção só (ex: Metal). Com
Metal + Tamanho, o botão vira **"Escolher opções"** e leva à página do produto.
Adicionar o tamanho errado sem a pessoa ver é pior do que um clique a mais.

**No celular** não existe hover. O botão vira um círculo com "+", sempre visível
no canto da imagem (`@media (hover: none)`).

---

## 6. Rodapé — newsletter e assinatura animada

**Arquivo:** `sections/rodape.liquid`

- **Newsletter:** `{% form 'customer' %}` nativo com `contact[tags]=newsletter`.
  O e-mail aparece em Admin → Clientes, com a tag *newsletter* e o consentimento de marketing.
- **Rótulo flutuante sem JS:** o input tem `placeholder=" "`. Quando há texto, o
  placeholder some e `:not(:placeholder-shown)` sobe o rótulo. O mesmo acontece no `:focus`.
- **Linha que desenha:** `transform: scaleX(0 → 1)` no `:focus-within` do campo.
- **Assinatura gigante:** `marca | split: ''` vira uma letra por `<span>`. O
  tamanho da fonte é calculado pelo número de letras (`--letras`), para caber em
  uma linha. As letras sobem em cascata quando a faixa entra na tela.
- **Voltar ao topo:** `href="#"` funciona sem JS. Com JS, rola suavemente.

---

## 7. Sistema de movimento

Toda animação do projeto segue 4 regras (`assets/movimento.css`):

| Regra | Por quê |
|---|---|
| Só `transform` e `opacity` | A GPU compõe essas propriedades sem recalcular layout, então rodam a 60fps até em celular simples |
| Curva `--ease-out` forte (`cubic-bezier(.22,1,.36,1)`) | Começa rápido e assenta devagar, como objetos reais |
| Cascata curta (70–80ms) | Dá ritmo sem fazer ninguém esperar |
| `prefers-reduced-motion` | Quem pediu menos movimento no sistema recebe tudo estático |

Para animar qualquer elemento novo ao rolar, basta:

```html
<div data-reveal>…</div>
<div data-reveal style="--reveal-index: 2">…</div>   <!-- entra 160ms depois -->
<div data-reveal="fade">…</div>                       <!-- só aparece, sem subir -->
```

O estado escondido só vale com a classe `.js` no `<html>`. **Sem JavaScript,
nada fica invisível.**

---

## 8. Roteiro de testes

Depois de importar o CSV, percorra esta lista:

| # | Produto / ação | O que deve acontecer |
|---|---|---|
| 1 | Abrir a home | Imagem do hero (ou aurora) faz zoom-out; palavras do título sobem uma a uma; selos aparecem por último |
| 2 | Rolar a página | Mídia do hero anda mais devagar (parallax); cards entram em cascata por linha |
| 3 | Clicar na seta do hero (desktop) | Rola suavemente até o catálogo |
| 4 | Trocar de aba (clique) | Indicador desliza; painel sai, altura anima, cards novos entram em cascata |
| 5 | Trocar de aba (teclado) | Tab até as abas, depois ← → Home End. Foco e painel acompanham |
| 6 | **Anel Orvalho Solitário** | Badges **-16%** e **Novo**; 3 swatches; compra rápida |
| 7 | Swatch → Ouro rosé no anel acima | Fundo do card fica rosado (ou a imagem troca, se houver foto da variante) |
| 8 | **Anel Folha Viva** → swatch Ouro rosé | Badge **Esgotado** aparece e botão fica desabilitado (estoque 0) |
| 9 | **Brinco Pétala** → swatch Prata | Preço muda de R$ 1.590 para R$ 890 |
| 10 | **Anel Raiz Eternity** / **Colar Galho** | Botão **Escolher opções** (2 opções). Swatch altera o link para `?variant=` |
| 11 | **Anel Semente** | Sem swatches; compra rápida direta |
| 12 | **Colar Flor do Campo** | Esgotado de nascença: badge + botão "Esgotado" (some no celular) |
| 13 | Clicar em "Adicionar à sacola" | Spinner, depois ✓ Adicionado; contador do header "pula"; alerta verde |
| 14 | Adicionar o mesmo produto 11× | Na 11ª vez (estoque 10), alerta **vermelho** com a mensagem do Shopify; nada recarrega |
| 15 | Celular / DevTools em modo touch | Botão vira círculo "+" sempre visível; grade em 2 colunas |
| 16 | Newsletter (e-mail válido) | Página recarrega com "Obrigado por se inscrever!"; cliente aparece no admin |
| 17 | Newsletter (e-mail inválido) | Mensagem de erro abaixo do campo |
| 18 | Rodapé entrando na tela | Colunas em cascata; letras de "Orvalho" sobem uma a uma |
| 19 | SO com "reduzir movimento" ligado | Tudo aparece estático, sem animação |
| 20 | Desativar JavaScript | Hero e rodapé visíveis; abas somem e **todos** os painéis aparecem empilhados; compra rápida leva ao carrinho |
| 21 | Editor de temas: mudar qualquer setting | Seção re-renderiza e continua funcionando (Web Component + `shopify:section:load`) |

---

## 9. Decisões e trade-offs

**Todos os painéis no HTML vs. buscar por AJAX.**
Com até 6 abas × 8 produtos, o HTML extra é pequeno, a troca é instantânea e
nada depende da rede. Para dezenas de abas ou "carregar mais", o caminho é a
**Section Rendering API** (exercício 1).

**Web Component (`customElements.define`) vs. script solto.**
O navegador chama `connectedCallback()` sempre que o elemento aparece, inclusive
quando o editor de temas re-renderiza a seção. Não é preciso reinicializar nada
manualmente. Os listeners globais são removidos no `disconnectedCallback()`.

**Dados no `data-*` vs. JSON do produto via API.**
O Liquid já tem preço formatado, URL e imagem de cada variante. Mandar isso
pronto evita reimplementar a formatação de moeda em JS e evita uma requisição por card.

**Sem bibliotecas.** Nenhum GSAP, jQuery ou Swiper. Tudo o que foi feito cabe
em CSS moderno + ~300 linhas de JS. Isso é menos peso, menos coisa para manter e
melhor nota no Lighthouse.

**Settings em português direto no schema** (`"label": "Título"`) em vez de chaves
`t:` como nas seções originais da base. É mais simples para aprender. Para um
tema publicado na Theme Store, o certo é usar `t:` + `locales/*.schema.json`.

---

## 10. Exercícios para praticar

Em ordem de dificuldade:

1. **"Carregar mais" com a Section Rendering API.**
   Crie `sections/grade-colecao.liquid`, que lista `collection.products` (a
   coleção **da página**) dentro de `{% paginate collection.products by 8 %}`.
   Depois, `fetch('/collections/aneis?section_id=grade-colecao&page=2')` devolve
   só o HTML dessa seção, renderizada na página 2. Extraia os `<li>`, anexe à
   grade e chame `window.Movimento.observar(grade)` para animar os novos.
2. **Lista de desejos com `localStorage`.** Coração no card, contador no header
   e evento `desejos:alterado`. Não precisa de backend.
3. **Cart drawer.** Ouça `carrinho:adicionado` e busque
   `/?sections=cart-drawer` (Section Rendering API) para atualizar a gaveta sem recarregar.
4. **Swatch nativo.** No admin, ligue a opção *Metal* ao metacampo de categoria
   *Cor*. O card passa a usar `valor.swatch.color` automaticamente, sem o mapa da seção.
5. **Badge de estoque baixo.** Mostre "Últimas unidades" quando
   `variant.inventory_quantity <= 3`. Atualize também no swatch, com mais um `data-*`.
6. **Hero com vídeo.** Adicione uma setting `video` e use
   `{{ section.settings.video | video_tag: autoplay: true, muted: true, loop: true }}`.

---

## 11. Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| Todas as abas mostram os mesmos produtos | As coleções `aneis`, `brincos` e `colares` não existem. Crie-as (passo 3) ou escolha outras no editor |
| `theme push` reclama de coleção inexistente no `index.json` | Crie as coleções antes, ou apague o valor de `"colecao"` no JSON e escolha pelo editor |
| Swatches não aparecem | O nome da opção do produto não está na setting "Opções que viram swatch" (comparação sem maiúsculas) |
| Swatch cinza | O valor não está no "Mapa de cores" e não há swatch nativo. Adicione `Nome: #hex` |
| "Adicionar" leva para a página do carrinho | O JS falhou (veja o console) ou a rede caiu. É o fallback funcionando |
| Textos em inglês | Idioma da loja ≠ português. Admin → Configurações → Idiomas → defina Português (Brasil) |
| `theme check` acusa `gift_card.liquid` | Falso positivo do analisador do linter no gerador de QR minificado (código anterior a este projeto). O tema sobe normalmente |
