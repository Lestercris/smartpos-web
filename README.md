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
  modulos/ticket/         Ticket imprimible con código de barras
  modulos/etiquetas/      Generador de etiquetas de precio con código de barras
movil/
  index.html              Vista del escáner
  js/sync.js              Lector Quagga2 + envío a Supabase
```

## Módulos de la aplicación

| Módulo | Qué hace |
| --- | --- |
| POS | Carrito por código de barras o teclado, cantidades, IVA por producto y total |
| Caja | Apertura/cierre de turno, monto inicial, arqueo y diferencia (las ventas anuladas no suman) |
| Productos | Alta, imagen, stock mínimo, precios, margen, IVA, edición con vista grande de imagen, duplicar, entrada/salida de stock con historial, importar/exportar Excel, etiquetas |
| Comprobantes | Búsqueda por escáner o folio, devoluciones parciales y anulación completa |
| Ventas | Reportes por período, KPIs, detalle, reimpresión de ticket y exportación a Excel |
| Clientes / Proveedores | Altas y bajas con tipo y número de documento |
| Ajustes | Categorías, subcategorías, ubicaciones, unidades de medida y tipos de documento |
| Escáner móvil | Envía el código al PC en tiempo real; los folios `T-xxxxxx` abren el comprobante |

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

> La clave `anon` es pública por diseño; la seguridad real depende de las políticas RLS configuradas en Supabase.

## Pendientes sugeridos

- Forma de pago (efectivo/tarjeta/transferencia), cálculo de vuelto y cliente en la venta.
- Datos fiscales del negocio en el ticket (nombre, RIF/NIT, dirección, logo).
- Descuentos por línea o por venta.
- Modo offline / PWA para seguir vendiendo sin internet.
- Usuarios con login y roles en lugar del usuario fijo "Vendedor Demo".
