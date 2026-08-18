# 🥐 BakeMaster Pro ERP - Sistema Integral para Panadería y Repostería (Costa Rica 🇨🇷)

Un sistema ERP **funcional, profesional y robusto** especializado para panaderías artesanales, reposterías y negocios de producción alimentaria en Costa Rica, adaptado a Colones costarricenses (₡ / CRC), métodos locales (SINPE Móvil, Tarjeta, Efectivo) y con el módulo **Asistente Inteligente (PanaderIA)**.

---

## 🌟 Módulos y Capacidades Implementadas

### 1. 📊 Dashboard Ejecutivo & Analítica BI
- **KPIs en tiempo real**: Ventas totales en colones (₡), Margen bruto promedio, Unidades producidas del día e Índice de merma.
- **Gráficos interactivos (Chart.js)**:
  - Curva de ventas por hora vs. pronóstico predictivo de IA en colones (₡).
  - Estructura de costos desglosada por harinas, mantequillas, coberturas, mano de obra y energía.
- **Programación de turnos de horno** y ranking de productos más rentables en colones.

### 2. 🥖 Producción & Escandallo de Recetas (El Corazón del ERP)
- **Fichas Técnicas Maestras** (Croissant Francés de Mantequilla, Baguette Rústico, Pan de Masa Madre Sourdough, Tarta Selva Negra).
- **Calculadora Dinámica de Rendimiento / Batch Scaler**: Multiplicador de lote que recalcula gramos de materia prima según porcentaje panadero, costos indirectos (electricidad de hornos y mano de obra), costo unitario exacto en colones (₡) y margen de ganancia (68% - 74%).
- **Ejecución de Lote**: Descuenta automáticamente las materias primas del inventario (harina de fuerza, mantequilla pura, levadura fresca) e ingresa las piezas terminadas al stock para la venta.
- **Control y Auditoría de Mermas**: Registro de mermas de horneado, sobre-fermentación y mostrador con cálculo del impacto monetario en ₡ CRC.

### 3. 🛒 Punto de Venta (POS) & Facturación Rápida
- Catálogo visual táctil filtrable por categorías (Panadería, Repostería, Cafetería de Especialidad, Combos).
- Búsqueda instantánea con validación de stock disponible.
- Selección de cliente con programa de puntos CRM.
- Métodos de pago locales: **Efectivo**, **Tarjeta / Datáfono** y **SINPE Móvil**.
- Generación de **Ticket Térmico Imprimible** con desglose de impuesto (IVA 13%) y animación de confetti.

### 4. 📦 Inventario, Materias Primas & Stock ("Cero Fricción")
- Control simultáneo de **Materias Primas**, **Productos Terminados** y **Material de Empaque**.
- **Entrada Rápida de Stock (4 Pasos)**: Modal guiado y ultrarrápido para ingresar compras de insumos en colones (₡) indicando nombre, cantidad/unidad, costo y fecha de vencimiento opcional, con actualización instantánea de existencias y valor del inventario.
- Trazabilidad por número de Lote y fecha de caducidad con ordenamiento FIFO y alertas contextuales.
- Módulo para **Ajustes Manuales de Cantidad** y bajas directas a merma.

### 5. 💵 Control de Turno de Caja & Arqueo Ciego
- Estado de caja (Apertura con fondo inicial, ventas en efectivo y electrónicas/SINPE, egresos menores).
- **Calculadora interactiva de billetaje en Colones**: Conteo de billetes de ₡20,000, ₡10,000, ₡5,000, ₡2,000, ₡1,000 y monedas varias con conciliación matemática automática contra el sistema (detección de faltante o sobrante).

### 6. 🚚 Logística & Rutas de Reparto
- Monitor de entregas a clientes corporativos en San José, Escazú y Santa Ana (hoteles, cafeterías y restaurantes).
- Línea de tiempo visual del estado de ruta con simulación de GPS y confirmación de entrega.

### 7. 👥 Clientes & CRM (Fidelización)
- Directorio de clientes con niveles de lealtad (Estándar, Plata, Oro, VIP).
- Puntos acumulables por compra y canje de beneficios.
- Simulador de campañas de promociones vía WhatsApp.

### 8. 🤖 Asistente Inteligente (PanaderIA)
- **Diseñado para el panadero y dueño de negocio**: Respuestas claras y directas sin tecnicismos en colones costarricenses (₡ CRC).
- **Acciones Directas en las Respuestas (1 Clic)**:
  * `[➕ Hornear 120 Croissants]` / `[➕ Hornear 90 Baguettes]`: Lanza inmediatamente la orden de producción con notificación al obrador.
  * `[🛒 Comprar 50kg Harina]` / `[🛒 Comprar 15kg Mantequilla]`: Registra la compra y actualiza el kardex y stock en tiempo real.
  * `[🥐 Transformar 10 Croissants a Bostocks]`: Registra el aprovechamiento de merma del día anterior.
  * `[💵 Abrir Calculadora de Billetaje]` / `[📊 Abrir Ficha Técnica]`: Enlaces interactivos directos a herramientas operativas.
- **Accesos Directos de Preguntas Frecuentes (Quick Prompts)**: Barra de burbujas/chips de consulta rápida (*"¿Qué se vence pronto?"*, *"¿Cuánto dinero hay en caja?"*, *"¿Cuál es el más vendido?"*, *"¿Qué materias comprar?"*, *"¿Alcanza la harina?"*).
- **Dictado por Voz (Speech-to-Text 🎤)**: Botón de micrófono integrado para que el panadero pueda dictar sus preguntas por voz mientras trabaja en el obrador.
- **Chat Interactivo y Widget Flotante**: Accesible desde cualquier pantalla del ERP para consultas al vuelo.

### 9. 🛡️ Seguridad, Auditoría & Selector de Roles
- Registro inmutable de eventos (Kardex, ventas, horneadas, egresos de caja).
- Selector dinámico de roles de prueba (Administrador General, Maestro Panadero, Cajero POS, Logística).
- Selector de multisucursal (Central, Norte, Gourmet).

---

## 🚀 Cómo Abrir y Probar el Demo

1. Abre el archivo [`index.html`](file:///C:/Users/garamirezm/Desktop/Proyectos%20Antigravity/Panaderia/index.html) directamente con tu navegador favorito (Google Chrome, Microsoft Edge, Firefox, Brave, etc.).
2. No requiere instalación previa ni dependencias de servidor.
