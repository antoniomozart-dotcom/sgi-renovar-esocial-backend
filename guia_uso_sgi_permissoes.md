# Como usar o sgi-permissoes.js nas páginas

Inclua o arquivo depois do `sgi-config.js`:

```html
<script src="sgi-config.js"></script>
<script src="sgi-permissoes.js"></script>
```

No início da página:

```javascript
let SGI_SCOPE = null;

async function iniciarPagina(){
  SGI_SCOPE = await SGI.permissoes.iniciar();

  await carregarGrupos();
  await carregarEmpresas();
}
```

Para consultar empresas:

```javascript
let query = supabaseClient
  .from("empresas")
  .select("*")
  .order("nome");

query = SGI.permissoes.aplicarFiltroTabelaEmpresas(query, SGI_SCOPE);

const { data, error } = await query;
```

Para consultar funcionários, CAT, ASO, PPP, EPI ou documentos:

```javascript
let query = supabaseClient
  .from("funcionarios")
  .select("*")
  .order("nome");

query = SGI.permissoes.aplicarFiltroEmpresa(query, SGI_SCOPE);

const { data, error } = await query;
```

Regra:
- `admin_renovar`: não filtra nada.
- `empresa_cliente`: filtra por `empresa_id` ou `grupo_id`.