# Pulso Celulares

> Projeto educacional de loja virtual de celulares, desenvolvido com Node.js, Express, JavaScript e SQLite. **Em desenvolvimento — não pronto para vendas reais.**

## Sobre o projeto

A **Pulso Celulares** é uma aplicação web de demonstração para exibir celulares, criar contas, administrar o catálogo e experimentar um fluxo de compras. O servidor disponibiliza uma API REST e os arquivos estáticos do frontend na mesma porta. Os dados são mantidos localmente em um arquivo SQLite por meio de `sql.js`.

> **Estado atual:** existem rotas e interfaces para carrinho, checkout e pagamentos, mas foram encontradas inconsistências no código que impedem considerar esse fluxo concluído. Os pagamentos são **simulações**, sem processamento financeiro real.

## Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js, Express 5 |
| Frontend | HTML5, CSS3 e JavaScript sem framework |
| Persistência | SQLite via `sql.js` |
| Autenticação | `jsonwebtoken` (JWT) |
| Senhas | `bcryptjs` |
| Configuração | `dotenv` |
| Integração de CEP (frontend) | ViaCEP |

## Funcionalidades identificadas no código

### Catálogo de produtos

- Consulta pública da lista de produtos e de um produto pelo ID.
- Cadastro, alteração e exclusão de produtos por usuários com papel `admin`.
- Armazenamento de nome, preço, marca, capacidade, cor e URL/caminho de imagem nas operações de cadastro.
- Criação automática de produtos de exemplo se a tabela estiver vazia; **preços e descrições dos exemplos são fictícios**.
- Estrutura do banco com campos adicionais de especificações e estoque; **não equivale a um gerenciamento completo de estoque**.

### Usuários e clientes

- Cadastro com nome, e-mail e senha; impede e-mail duplicado.
- Hash de senha com bcrypt.
- Login com JWT válido por **2 horas**.
- Papéis `cliente` e `admin`, com middleware de autorização para editar o catálogo.
- Leitura e atualização dos dados cadastrais do próprio cliente, com validação de CPF, telefone, CEP e endereço.
- Preenchimento assistido do endereço por CEP no código do frontend via ViaCEP.

### Carrinho e pagamentos — implementação parcial

- Há código para adicionar, remover e alterar quantidades no carrinho, com armazenamento local no navegador.
- Há telas e rotas para checkout, consulta de pedidos e pagamento em uma ou duas modalidades diferentes.
- O código prevê cartão de crédito, cartão de débito e Pix **simulados**.
- Existe cálculo de parcelamento de até 10 vezes, respeitando uma parcela mínima de R$ 50,00, e expiração configurável do Pix de teste.
- A lógica de pedidos usa valores monetários em centavos e recalcula preços com dados do servidor.
- As rotas de pedidos exigem autenticação, e a consulta de um pedido restringe o acesso ao proprietário ou administrador.

**Importante:** essas funcionalidades de checkout estão presentes no código, mas **não estão confirmadas como operacionais de ponta a ponta**. Veja [Limitações conhecidas](#limitações-conhecidas).

## Requisitos

- **Node.js 18 ou superior** (preferencialmente uma versão LTS atual).
- npm.
- Git (para clonar o projeto).

## Instalação

Clone o repositório:

```bash
git clone https://github.com/ferreira-zxk/back-end_Davi2.0.git
cd back-end_Davi2.0
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo **`.env`** na raiz do projeto com:

```dotenv
JWT_SEGREDO=substitua_por_uma_chave_aleatoria_longa
ADMIN_EMAIL=seu-email-de-administrador@exemplo.com
PAGAMENTO_SIMULADO=true
PIX_EXPIRA_MIN=30
```

Para gerar uma chave JWT aleatória usando Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `JWT_SEGREDO`. **Nunca divulgue essa chave nem faça commit do `.env`.** O repositório já possui regras de `.gitignore` para ignorar arquivos `.env` e `.db` não rastreados.

### Conta de administrador

O e-mail definido em `ADMIN_EMAIL` é comparado ao e-mail usado no cadastro. A aplicação atribui o papel `admin` à conta com esse e-mail e também promove uma conta preexistente correspondente quando o banco é inicializado.

**Atenção:** esta é uma configuração apropriada apenas para demonstração em ambiente controlado. Antes de publicar a aplicação, substitua esse mecanismo por provisionamento seguro de administrador. Não use dados ou credenciais reais em ambientes de teste.

### Executar a aplicação

O arquivo `package.json` consultado **não define um script `start`**. Inicie diretamente com:

```bash
node index.js
```

A aplicação configura a porta **3000**. Abra:

```text
http://localhost:3000
```

O banco é inicializado automaticamente em `dados/loja.db` e recebe tabelas e dados de exemplo quando necessário.

## Rotas da API

**Base:** `http://localhost:3000`  
**Autenticação:** `Authorization: Bearer <TOKEN>` nas rotas protegidas.

| Método | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| `GET` | `/produtos` | Público | Listar produtos |
| `GET` | `/produtos/:id` | Público | Consultar produto |
| `POST` | `/produtos` | Admin | Cadastrar produto |
| `PUT` | `/produtos/:id` | Admin | Atualizar produto |
| `DELETE` | `/produtos/:id` | Admin | Excluir produto |
| `POST` | `/auth/cadastro` | Público | Criar conta |
| `POST` | `/auth/login` | Público | Autenticar e emitir JWT |
| `GET` | `/clientes/eu` | Autenticado | Consultar cadastro próprio |
| `PUT` | `/clientes/eu` | Autenticado | Salvar cadastro próprio |
| `POST` | `/pedidos` | Autenticado | Criar pedido (fluxo com problema conhecido) |
| `GET` | `/pedidos` | Autenticado | Listar pedidos próprios |
| `GET` | `/pedidos/:id` | Proprietário ou admin | Consultar pedido e situação do pagamento |
| `POST` | `/pedidos/:id/pagamentos/:pagamentoId/simular-pix` | Proprietário, em modo de teste | Simular aprovação de Pix |

A última rota é bloqueada com HTTP `403` quando `PAGAMENTO_SIMULADO=false`. Isso **não ativa pagamentos reais**: apenas desabilita a confirmação manual simulada.

### Exemplos de requisições

Cadastro:

```bash
curl -X POST http://localhost:3000/auth/cadastro \
  -H "Content-Type: application/json" \
  -d '{"nome":"Cliente Exemplo","email":"cliente@example.com","senha":"senha12345"}'
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@example.com","senha":"senha12345"}'
```

Listagem pública:

```bash
curl http://localhost:3000/produtos
```

Cadastro de produto (utilize um token de administrador):

```bash
curl -X POST http://localhost:3000/produtos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -d '{"nome":"Celular de exemplo","preco":1299.90,"marca":"Marca exemplo","armazenamento":"128 GB","cor":"Preto"}'
```

## Organização principal

```text
back-end_Davi2.0/
├── index.js                 # Express, rotas e inicialização
├── package.json             # Dependências e scripts
├── .gitignore
├── dados/
│   ├── banco.js             # Criação/migração e acesso ao SQLite
│   ├── produtosRepositorio.js
│   ├── usuariosRepositorio.js
│   ├── clientesRepositorio.js
│   └── pedidosRepositorio.js
├── controllers/
│   ├── produtosController.js
│   ├── authController.js
│   ├── clientesController.js
│   └── pedidosController.js
├── routes/
│   ├── produtosRoutes.js
│   ├── authRoutes.js
│   ├── clientesRoutes.js
│   └── pedidosRoutes.js
├── middlewares/
│   ├── autenticar.js
│   └── soAdmin.js
├── servicos/
│   ├── pagamentos.js
│   └── validacoes.js
├── public/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── carrinho.js
├── teste.js                 # Testes por requisições HTTP
└── teste-pedidos.js         # Testes do fluxo de pedidos
```

## Banco de dados

O `dados/banco.js` cria ou adapta tabelas para:

- `produtos`, `usuarios` e `clientes`;
- `pedidos`, `pedido_itens`, `pagamentos` e `pedido_eventos`;
- `cupons` e `redefinicoes_senha`.

**Observação:** a existência de tabelas de cupom e recuperação de senha **não comprova** que esses recursos estejam disponíveis na API atual. As rotas cadastradas no `index.js` são as listadas acima.

O projeto usa um arquivo de banco local. Para preservar os dados, faça cópias de segurança de `dados/loja.db` com o servidor parado. Evite armazenar dados reais de clientes ou pagamentos enquanto a aplicação não tiver passado por uma revisão de segurança.

## Testes

Inicie o servidor em um terminal e execute, em outro:

```bash
node teste.js
```

O arquivo `teste.js` verifica cenários de cadastro, login, JWT, permissões de administrador e CRUD de produtos. Ele utiliza a conta de teste `admin@pulso.com`, por isso exige que `ADMIN_EMAIL` tenha esse valor em um **banco de testes isolado** para os cenários de administrador.

O repositório também contém:

```bash
node teste-pedidos.js
```

Esse script tenta cobrir o fluxo de pedidos e pagamentos simulados, mas os resultados **não foram executados nem confirmados nesta análise**. O comando `npm test` **não executa esses testes**: no `package.json` verificado, o script `test` ainda é apenas um placeholder que retorna erro.

## Limitações conhecidas

1. **Scripts do frontend duplicados:** na versão inspecionada, `public/script.js` e `public/carrinho.js` contêm declarações globais iguais, enquanto `public/index.html` carrega ambos. Isso pode provocar erro de redeclaração de constantes no navegador e impedir o funcionamento da interface.
2. **Contrato incompatível na criação de pedidos:** `controllers/pedidosController.js` chama `pedidosRepo.criar(req.usuario.id, total)` passando um número como segundo argumento, mas `dados/pedidosRepositorio.js` espera um objeto com campos como `subtotal`, `desconto`, `frete` e `total`. O checkout precisa ser corrigido antes de ser considerado funcional.
3. **Pagamentos fictícios:** a autorização de cartão e o código Pix são simulados, sem adquirente, gateway, cobrança real ou liquidação financeira.
4. **Sem comando de inicialização npm:** `package.json` não possui `start`, e `npm test` está configurado para falhar.
5. **Sem preparação comprovada para produção:** não há evidência, nos arquivos analisados, de infraestrutura completa para operação comercial, como gateway de pagamento real, monitoramento e proteção robusta contra abuso.
6. **Segurança de administrador para demonstração:** o papel `admin` é concedido com base em um e-mail configurado no ambiente, o que exige reforço antes de exposição pública.

## Cuidados de segurança

- Mantenha `JWT_SEGREDO` em segredo e utilize uma chave longa e imprevisível.
- Nunca envie `.env`, tokens JWT ou dados pessoais para o GitHub.
- Use HTTPS ao implantar fora do ambiente local.
- Não utilize números de cartões reais no checkout de teste.
- Revise as regras de autenticação e autorização antes de publicar.
- Corrija as inconsistências conhecidas e execute os testes novamente após qualquer alteração.
- Não interprete `PAGAMENTO_SIMULADO=false` como ativação de pagamentos de verdade.

## Próximas melhorias

- [ ] Corrigir os scripts frontend duplicados e revisar o carregamento do checkout.
- [ ] Alinhar os argumentos da criação de pedidos entre controller e repositório.
- [ ] Executar e corrigir as suítes `teste.js` e `teste-pedidos.js` em um banco isolado.
- [ ] Adicionar scripts `start` e `test` no `package.json`.
- [ ] Implementar provisionamento seguro de administradores.
- [ ] Adicionar controles de segurança, limites de requisição e testes automatizados em CI.
- [ ] Integrar um provedor de pagamentos real **apenas após revisão de segurança**.
- [ ] Avaliar a implementação das funcionalidades de cupons, frete e recuperação de senha ainda não expostas pelas rotas analisadas.

## Autor

Desenvolvido por [ferreira-zxk](https://github.com/ferreira-zxk).

**Repositório:** [back-end_Davi2.0](https://github.com/ferreira-zxk/back-end_Davi2.0)

## Licença e uso

**Projeto privado para fins de estudo e aprendizado. Todos os direitos reservados.**

Este projeto foi desenvolvido exclusivamente para estudos, prática de programação e demonstração educacional. O código **não está licenciado para uso, reprodução, modificação, redistribuição ou exploração comercial por terceiros** sem autorização prévia e expressa do autor.

O acesso público ao repositório, caso esteja disponível no GitHub, **não representa permissão para reutilização do código**. Este projeto não adota uma licença de código aberto.

Copyright © 2026 [ferreira-zxk](https://github.com/ferreira-zxk). Todos os direitos reservados.
