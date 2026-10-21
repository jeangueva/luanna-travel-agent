# Portales de alojamiento

La plataforma en `/plataforma` administra un único espacio privado. La landing
mantiene su simulador comercial; sus cifras no son reservas ni ingresos reales.
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

`npm test` cubre validación, firma y expiración de sesión, acceso anónimo,
origen cruzado y cookies. `npm run build` verifica TypeScript y compilación.
La prueba completa de persistencia requiere una base configurada y la migración.
Ejecutar `node --env-file=.env --import tsx --test test/portales-db.integration.ts`
desde `web/`: crea un registro temporal, comprueba publicación, edición y retiro,
y elimina exclusivamente ese registro al terminar.
Stay22 requiere además una cuenta afiliada válida: la presencia del identificador
indica configuración, no acredita que el proveedor haya aprobado la cuenta.
