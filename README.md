# SmartPOS Web

Punto de venta (POS) para comercio minorista: caja en el PC y escáner de códigos en el móvil, sincronizados en tiempo real con Supabase.

- `pc/` — aplicación de escritorio: venta, administración, reportes e impresión de tickets.
- `movil/` — escáner de códigos de barras con la cámara del móvil que envía los códigos al PC.

## Cómo probarlo en local

Con Python instalado, desde la raíz del repositorio:

```bash
python -m http.server 5500
```

Abrir `http://127.0.0.1:5500/pc/index.html`.

> Hace falta un servidor (no vale abrir el HTML con doble clic) porque el módulo de ticket carga su HTML con `fetch`.

## Estructura

```
pc/
  index.html              Interfaz: POS, administración y modales
  css/styles.css          Estilos generales (tarjetas, tablas, pestañas, reportes)
  js/db.js                Credenciales de Supabase y configuración (IVA, moneda)
  js/pos.js               Lógica del POS, productos, clientes, proveedores, ajustes, comprobantes
  js/ventas.js            Pestaña Ventas: reportes, detalle y exportación a Excel
  js/realtime.js          Escucha los códigos enviados por el móvil
  js/offline.js           Modo sin conexión: catálogo local, cola de ventas y sincronización
  sw.js                   Service worker (caché de la app)
  manifest.json           Instalación como aplicación (PWA)
  icon.svg                Icono de la app
  modulos/ticket/         Ticket imprimible con código de barras
  modulos/etiquetas/      Generador de etiquetas de precio con código de barras
movil/
  index.html              Vista del escáner
  js/sync.js              Lector Quagga2 + envío a Supabase
```

## Módulos de la aplicación

| Módulo | Qué hace |
| --- | --- |
| POS | Carrito por código de barras o teclado, cantidades, IVA por producto, cliente en la venta, forma de pago (efectivo/tarjeta/transferencia) y cálculo de vuelto |
| Caja | Apertura/cierre de turno, monto inicial, arqueo y diferencia (las ventas anuladas no suman) |
| Productos | Alta, imagen, stock mínimo, precios, margen, IVA, edición con vista grande de imagen, duplicar, entrada/salida de stock con historial, importar/exportar Excel, etiquetas |
| Comprobantes | Búsqueda por escáner o folio, devoluciones parciales y anulación completa |
| Ventas | Reportes por período, KPIs, detalle, reimpresión de ticket y exportación a Excel |
| Promociones | Rebajas por producto o para todos, con fechas: descuento % o lleva N paga M (2x1, 3x2); el POS aplica la mejor vigente |
| Clientes / Proveedores | Altas y bajas con tipo y número de documento |
| Ajustes | Categorías, subcategorías, ubicaciones, unidades de medida, tipos de documento, IVA y datos del negocio |
| Escáner móvil | Envía el código al PC en tiempo real; los folios `T-xxxxxx` abren el comprobante |
| Sin conexión / PWA | Instalable en PC y móvil; guarda el catálogo y encola las ventas para enviarlas al volver internet |

## Configuración

Todo lo ajustable está en `pc/js/db.js`:

```js
const SUPABASE_URL = '...';
const SUPABASE_ANON_KEY = '...';
const SMARTPOS_CONFIG = { IVA_RATE: 0.18, MONEDA: '$' };
```

`movil/js/sync.js` repite las credenciales por separado.

## Base de datos (Supabase)

Tablas usadas: `productos`, `categorias`, `subcategorias`, `proveedores`, `ubicaciones`, `unidades_medida`, `tipos_documento`, `clientes`, `ventas`, `venta_detalles`, `turnos`, `devoluciones`, `devolucion_detalles`, `escaneos`.

Funciones RPC: `realizar_venta`, `procesar_devolucion`, `anular_venta_completa`.

Bucket de Storage: `productos-imagenes`.

Los scripts de corrección de esquema están en [`sql/`](sql/). Hay que ejecutarlos en **Supabase → SQL Editor**, en orden:

1. `sql/001_fix_ventas_estado.sql` — añade `ventas.estado` (la necesitan la anulación, el arqueo y los reportes).
2. `sql/002_rls_lectura_venta_detalles.sql` — permite leer `venta_detalles` desde el navegador cuando RLS está activo (sin esto el comprobante sale sin productos).
3. `sql/003_limpiar_duplicados.sql` — borra líneas duplicadas y crea un índice único `(venta_id, producto_id)` para que no se repitan.
4. `sql/004_rls_lectura_devoluciones.sql` — permite leer `devoluciones` y `devolucion_detalles` desde el navegador (sin esto, una devolución se guarda pero el comprobante sigue mostrando 0 devuelto).
5. `sql/005_movimientos_stock.sql` — tabla `movimientos_stock` con el historial de entradas y salidas de inventario.
6. `sql/006_ocultar_productos.sql` — columna `productos.activo` para ocultar productos con ventas (sin romper el historial) y permisos de borrado con RLS.
7. `sql/007_metodo_pago.sql` — forma de pago (efectivo/tarjeta/transferencia), importe recibido y vuelto en cada venta.
8. `sql/008_registrar_cobro.sql` — `registrar_cobro`: guarda el total real cobrado (con IVA) y la forma de pago en una sola llamada.
9. `sql/009_configuracion_iva.sql` — tabla `smartpos_config` para guardar el porcentaje de IVA editable desde Ajustes.
10. `sql/010_promociones.sql` — tabla `promociones` (rebajas por producto con fechas) y función para dejar el precio de las líneas en lo realmente cobrado.
11. `sql/011_permisos_tablas.sql` — permisos y políticas RLS de las tablas nuevas (`promociones`, `movimientos_stock`, `smartpos_config`).
12. `sql/012_cliente_venta.sql` — cliente asociado a cada venta (`cliente_id` y `cliente_nombre`).
13. `sql/013_promos_nxm.sql` — tipo de promoción y campos `lleva`/`paga` para 2x1, 3x2, etc.
14. `sql/014_descuento_venta.sql` — descuento manual por venta (`descuento`).

> La clave `anon` es pública por diseño; la seguridad real depende de las políticas RLS configuradas en Supabase.

## Pendientes sugeridos

- Descuentos por línea o por venta.
- Modo offline / PWA para seguir vendiendo sin internet.
- Usuarios con login y roles en lugar del usuario fijo "Vendedor Demo".

## Modo sin conexión (PWA)

- La app se puede instalar desde el navegador (icono de instalar en la barra de direcciones).
- El service worker (sw.js) guarda la aplicación y las librerías para abrirla sin internet.
- Al arrancar se guarda el catálogo (productos y promociones) en IndexedDB.
- Sin conexión se puede vender: la venta se encola y se sincroniza automáticamente al volver internet (o al pulsar el aviso del encabezado).
- El ticket de una venta offline es provisional (P1, P2...) y lleva el aviso "Pendiente de enviar".
- Si cambias archivos del shell, sube la versión en CACHE dentro de sw.js para forzar la actualización.