# Portales de alojamiento

La plataforma en `/plataforma` administra un único espacio privado. La landing
explica el flujo con ejemplos ilustrativos, sin prometer reservas ni ingresos.
Esta versión no es multicliente: todas las personas que tengan la clave comparten
las mismas sedes. No admite datos de pacientes.

## Configuración

1. Definir `DATABASE_URL` de Neon PostgreSQL en el entorno del servidor.
2. Ejecutar `web/migrations/001_ancla_portales.sql` sobre esa base. La migración
   agrega una tabla independiente y no modifica las tablas anteriores.
3. Generar una clave aleatoria con `openssl rand -hex 32` y guardarla como
   `ANCLA_ADMIN_SECRET` en el entorno del servidor. Nunca usar el prefijo
   `NEXT_PUBLIC_` para esta clave ni guardarla en Git.
4. Configurar `NEXT_PUBLIC_STAY22_AID` con el identificador asignado por Stay22.
   El portal funciona sin él, mostrando que la búsqueda no está disponible.
5. Ejecutar `npm run dev` desde `web/` y entrar en `/plataforma`.

En producción usar HTTPS. Las sesiones duran ocho horas, con cookie HttpOnly,
SameSite Strict y Secure bajo HTTPS. Cambiar ANCLA_ADMIN_SECRET invalida todas
las sesiones. Cerrar sesión elimina la cookie del navegador; no revoca otras
copias de una sesión. Antes de abrir el acceso a más usuarios, añadir identidad
individual, límites de intentos en el acceso y separación por organización.

## Flujo

Crear sede → guardar borrador → activar publicación y guardar → compartir `/p/UUID`
o insertar el iframe generado. Desactivar publicación y guardar retira el portal:
las nuevas peticiones devuelven 404. Una página ya abierta puede seguir mostrando
su contenido hasta recargarla. No se eliminan registros al retirar un portal.

Los portales publicados muestran únicamente la configuración guardada. El mapa
Stay22 usa coordenadas y fechas de esa sede. La disponibilidad y la reserva quedan
en el proveedor; no se verifican accesibilidad, tráfico, recuperación clínica,
tarifas flexibles ni coberturas de seguro. No hay cobro, liquidación ni vuelos
integrados en este flujo. El iframe no necesita paquetes npm ni un CDN de Luanna.

La API privada valida coordenadas, fechas reales, estancias de 1–90 noches y
longitudes de texto. No guarda campos arbitrarios enviados por el cliente.
Las mutaciones requieren sesión y origen coincidente. No se genera ni consulta
inventario ficticio en los portales públicos.

## Verificación

### Experiencia visual y recorrido

`/plataforma/demo` permite explorar el editor sin credenciales. Sus cambios viven
solo en memoria y no publican portales ni escriben en la base de datos.
El recorrido de cinco pasos aparece en la primera visita por navegador; se puede
omitir, cerrar con Escape y repetir desde Ayuda. La demo usa una preferencia
separada para no ocultar el recorrido del espacio real.

La landing, el acceso y el editor comparten Poppins, acentos Source Serif 4 y
superficies liquid glass en escala de grises. El video externo se puede pausar;
con movimiento reducido se usa inicialmente un fondo estático. Si falla la
carga del video, el contenido y los controles siguen disponibles.

### Pruebas técnicas

`npm test` cubre validación, firma y expiración de sesión, acceso anónimo,
origen cruzado y cookies. `npm run build` verifica TypeScript y compilación.
La prueba completa de persistencia requiere una base configurada y la migración.
Ejecutar `node --env-file=.env --import tsx --test test/portales-db.integration.ts`
desde `web/`: crea un registro temporal, comprueba publicación, edición y retiro,
y elimina exclusivamente ese registro al terminar.
Stay22 requiere además una cuenta afiliada válida: la presencia del identificador
indica configuración, no acredita que el proveedor haya aprobado la cuenta.
