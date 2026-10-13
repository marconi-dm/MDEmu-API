# MDEmu API • Vercel + Samsung Tizen

## O que este pacote faz

- Publica `GET /api/health` e `GET /api/games` por HTTPS, sem banco de dados nem dependências npm.
- Entrega ROMs de teste autorizadas pelo caminho `/roms/...`.
- Entrega os arquivos do EmulatorJS pelo caminho `/emulatorjs/data/...`.
- Habilita cabeçalhos CORS para o aplicativo Tizen buscar os arquivos pelo navegador.
- Inclui `diagnostico.html` para saber quais recursos retornam HTTP 200/206.
- Inclui `jogar.html` para validar o jogo no navegador **antes** de fazer um novo build da TV.
- Fornece arquivos em `tizen/` para substituir **posteriormente** no projeto Tizen já existente.

**Atenção:** ROMs e binários do EmulatorJS **não estão incluídos** no ZIP. Os diretórios `public/roms/` e `public/emulatorjs/data/` vêm apenas com instruções. Se não os preencher, `diagnostico.html` exibirá falhas de maneira esperada.

## 1. Onde colocar cada arquivo

```text
MDEmu_API_Vercel/
├── api/
│   ├── games.js
│   └── health.js
├── public/
│   ├── index.html
│   ├── diagnostico.html
│   ├── jogar.html
│   ├── roms/
│   │   └── teste.sfc                    ← adicione ROM autorizada
│   └── emulatorjs/
│       └── data/
│           ├── loader.js
│           ├── emulator.min.js
│           ├── compression/...
│           └── cores/...
├── tizen/                                  ← arquivos para copiar depois à TV
│   ├── index.html
│   ├── emulator.html
│   └── CONFIG_XML_ADICIONAR.txt
├── package.json
├── vercel.json
└── README.md
```

## 2. Adicionar o EmulatorJS (antes de publicar)

Você já baixou uma cópia local para este caminho (se não mudou a pasta):

`C:\Users\marco\Documents\Projetos\MDPlay\MDEmu\emulatorjs\data`

Copie **todo o conteúdo dessa pasta `data`**, inclusive `cores`, `compression`, `localization` etc., para:

`MDEmu_API_Vercel\public\emulatorjs\data`

Uma forma em PowerShell, a partir da pasta `MDEmu_API_Vercel`:

```powershell
$source = 'C:\Users\marco\Documents\Projetos\MDPlay\MDEmu\emulatorjs\data'
$dest = Join-Path (Get-Location) 'public\emulatorjs\data'
Copy-Item "$source\*" $dest -Recurse -Force
```

**Importante:** nos logs anteriores, o navegador tentou ler `cores/snes9x-legacy-wasm.data` e `compression/extract7z.js`. Verifique que esses arquivos existam. Caso não existam, obtenha a distribuição completa da versão estável em https://cdn.emulatorjs.org/releases/ e mantenha os arquivos da mesma versão. Não misture `loader.js` de uma versão com os demais arquivos de outra. Respeite a licença e os avisos da distribuição.

## 3. Adicionar uma ROM de teste

Para testar com arquivo público, coloque uma ROM de SNES que você **tem autorização para hospedar e distribuir** como:

`public/roms/teste.sfc`

O catálogo em `api/games.js` está configurado temporariamente com `id: 'metroid'` para continuar compatível com a seleção do MDEmu, mas a ROM é chamada `teste.sfc` e o título é genérico. Edite o ID, título e caminho quando registrar outro jogo.

**Não faça upload de ROM comercial para uma pasta pública da Vercel sem autorização para distribuí-la.** Para arquivos privados, usaremos numa etapa posterior armazenamento privado com autenticação e URL temporária assinada. Isso também permitirá a biblioteca protegida.

## 4. Publicar na Vercel SEM instalar Node.js

1. Crie um repositório GitHub separado, por exemplo `MDEmu-API`.
2. Envie para o repositório **o conteúdo inteiro desta pasta** (a raiz deve conter `api`, `public`, `package.json`, `vercel.json`).
3. Em https://vercel.com/new, escolha **Import Git Repository** e selecione `MDEmu-API`.
4. Use o framework **Other**. Não defina uma pasta `dist`, não configure comandos de build especiais.
5. Clique **Deploy** e aguarde a URL HTTPS, por exemplo `https://mdemu-api.vercel.app`.

A Vercel executa a API em Node.js **nos servidores dela**. Não é necessário instalar Node.js no seu Windows para fazer deploy pelo GitHub.

Se usar Git pelo VS Code: faça `git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`, ou simplesmente faça upload dos arquivos extraídos pela interface web do GitHub.

## 5. Testes na URL da Vercel, ANTES do Tizen

Troque `SEU-DOMINIO` pelo endereço real:

1. `https://SEU-DOMINIO/api/health` → deve devolver `"ok": true`.
2. `https://SEU-DOMINIO/api/games` → deve devolver a lista com `romUrl` HTTPS.
3. `https://SEU-DOMINIO/diagnostico.html` → confira os recursos. Valores HTTP 404 indicam arquivos ausentes.
4. `https://SEU-DOMINIO/jogar.html?id=metroid` → teste a emulação em um navegador com o conteúdo autorizado.

Observação: apenas `/api/health` e `/api/games` devem funcionar sem adicionar ROMs ou os arquivos do EmulatorJS. Não há como testar emulação enquanto faltarem esses arquivos.

## 6. Conectar o aplicativo Tizen SOMENTE após os testes da Vercel

1. Faça backup dos atuais `index.html` e `emulator.html` do projeto `MDEmu`.
2. Copie `tizen/index.html` e `tizen/emulator.html` para o projeto Tizen.
3. Nos **dois arquivos**, substitua `https://SEU-PROJETO.vercel.app` pela URL real da Vercel, sem barra final.
4. No `config.xml` existente, **mantenha o ID e o certificado** e verifique:

```xml
<tizen:privilege name="http://tizen.org/privilege/internet"/>
<access origin="https://SEU-PROJETO.vercel.app" subdomains="true"/>
```

5. Se existir CSP restritiva, permita a origem HTTPS da Vercel para `connect-src` e `script-src`; não copie uma CSP ampla sem verificar a atual.
6. Faça o Build Signed Package e instale o WGT atualizado na TV.
7. Acesse o aplicativo: a biblioteca virá de `/api/games` e a emulação tentará executar ROM e núcleo via HTTPS.

Nesta fase, `EJS_startOnLoaded` é `true`; botões nativos de configuração/salvamento ficam disponíveis, mas o funcionamento do analógico como direcional e a persistência de saves na Samsung **ainda precisam ser verificados**. Esta alteração visa **isolar o erro de rede**, não fazer simultaneamente mudanças de mapeamento.

## 7. Próximos passos

1. Confirmar jogo via HTTPS no navegador e depois na Samsung.
2. Validar entradas Xbox e analógico no Snes9x.
3. Validar Save State / Load State e retenção dos dados após reiniciar.
4. Mover ROMs para um storage privado e cadastrar jogos em banco.
5. Proteger acesso à biblioteca e permitir URL temporária por jogo.

## Fontes

- Vercel Functions: https://vercel.com/docs/functions/configuring-functions/runtime
- Configuração Vercel: https://vercel.com/docs/project-configuration/vercel-json
- Samsung Tizen permissões: https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html
- EmulatorJS opções: https://emulatorjs.org/docs/options/
- EmulatorJS CORS: https://emulatorjs.org/docs/faq/
