# Integraciones de Luanna

Todas cargan el mismo script, `https://luanna.app/embed.js`, que convierte
`<div data-luanna="ID"></div>` en el portal de la sede (iframe aislado con
altura automática). El estilo lo define la marca de la sede en la plataforma.

| Dónde | Qué usar |
|---|---|
| Cualquier web (Wix, Webflow, Squarespace, HTML) | Las dos líneas de abajo |
| WordPress | `wordpress/luanna` → subir como plugin, atajo `[luanna]` |
| Shopify | `shopify/` → app con bloque de tema «Luanna» (`shopify app deploy`) |
| Sin web | El enlace `https://luanna.app/p/ID` |

```html
<div data-luanna="ID-DE-TU-SEDE"></div>
<script src="https://luanna.app/embed.js" async></script>
```

Atributos opcionales: `data-lang="es|en"` (si no, el idioma del visitante).

## Publicar
- WordPress: `cd plugins/wordpress && zip -r luanna.zip luanna`. Para el directorio oficial, enviar a wordpress.org/plugins/developers.
- Shopify: crear la app en partners.shopify.com, poner `client_id` en `shopify.app.toml` y correr `shopify app deploy` desde `plugins/shopify`.

`embed.js` apunta a `luanna.app`. Mientras ese dominio no sirva el Worker
`luanna-web`, cambiar `LUANNA_ORIGEN` (WordPress) y la URL del bloque (Shopify)
por la de workers.dev.
