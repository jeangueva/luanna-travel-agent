<?php
/**
 * Plugin Name: Luanna — Vuelos y alojamiento para tus clientes
 * Description: Muestra el portal de Luanna en cualquier página con el atajo [luanna id="..."]. Gratis: Luanna gana comisión de aerolíneas y hoteles.
 * Version: 1.0.0
 * Author: Luanna
 * License: GPLv2 or later
 * Text Domain: luanna
 */

if (!defined('ABSPATH')) exit;

const LUANNA_ORIGEN = 'https://luanna.app';

/** Ajustes > Luanna: guarda el id de la sede para no repetirlo en cada atajo. */
add_action('admin_menu', function () {
  add_options_page('Luanna', 'Luanna', 'manage_options', 'luanna', 'luanna_pagina_ajustes');
});

add_action('admin_init', function () {
  register_setting('luanna', 'luanna_sede', [
    'type' => 'string',
    'sanitize_callback' => 'luanna_limpiar_id',
  ]);
});

function luanna_limpiar_id($valor) {
  $valor = trim((string) $valor);
  return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $valor) ? strtolower($valor) : '';
}

function luanna_pagina_ajustes() { ?>
  <div class="wrap">
    <h1>Luanna</h1>
    <p>Pega el id de tu sede. Lo encuentras en tu plataforma de Luanna, en «Compartir».</p>
    <form method="post" action="options.php">
      <?php settings_fields('luanna'); ?>
      <label for="luanna_sede"><strong>Id de la sede</strong></label><br>
      <input id="luanna_sede" name="luanna_sede" class="regular-text" value="<?php echo esc_attr(get_option('luanna_sede')); ?>">
      <?php submit_button('Guardar'); ?>
    </form>
    <p>Después escribe <code>[luanna]</code> en cualquier página o entrada.</p>
  </div>
<?php }

/** [luanna], [luanna id="..."] o [luanna idioma="en"] */
add_shortcode('luanna', function ($atts) {
  $atts = shortcode_atts(['id' => get_option('luanna_sede'), 'idioma' => ''], $atts, 'luanna');
  $id = luanna_limpiar_id($atts['id']);
  if (!$id) {
    return current_user_can('manage_options') ? '<p>Luanna: falta el id de la sede (Ajustes &gt; Luanna).</p>' : '';
  }
  wp_enqueue_script('luanna-embed', LUANNA_ORIGEN . '/embed.js', [], null, ['strategy' => 'async', 'in_footer' => true]);
  $idioma = in_array($atts['idioma'], ['es', 'en'], true) ? $atts['idioma'] : '';
  return sprintf('<div data-luanna="%s"%s></div>', esc_attr($id), $idioma ? ' data-lang="' . esc_attr($idioma) . '"' : '');
});
