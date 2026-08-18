/**
 * BAKEMASTER PRO ERP - MASTER APPLICATION CONTROLLER
 * Sistema Integral para Panadería y Repostería Artesanal
 * Versión Costa Rica (₡ / CRC) & Asistente Inteligente PanaderIA
 */

// ==========================================
// 0. INVENTORY INTELLIGENCE LAYER
// ==========================================

/** Returns number of calendar days until a given ISO date string. */
function daysUntilExpiry(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(dateStr); exp.setHours(0,0,0,0);
  return Math.round((exp - today) / 86400000);
}

/**
 * Central alerts scanner — returns arrays of low-stock and expiry alerts.
 */
function getInventoryAlerts() {
  const lowStock = [];
  const nearExpiry = []; // ≤ 7 days
  const expired   = []; // ≤ 0 days (already past)

  appState.inventory.forEach(item => {
    // Low-stock check
    if (item.stock <= item.minStock) {
      lowStock.push({ item, pct: Math.round((item.stock / item.minStock) * 100) });
    }
    // Expiry check
    const days = daysUntilExpiry(item.expiry);
    if (days <= 0) {
      expired.push({ item, days });
    } else if (days <= 7) {
      nearExpiry.push({ item, days });
    }
  });

  return { lowStock, nearExpiry, expired };
}

/**
 * Auto-expire finished goods: moves items with expiry ≤ 0 days to the waste
 * register and zeroes their stock so they don't appear in the POS.
 */
function autoExpireFinishedGoods() {
  const today = new Date(); today.setHours(0,0,0,0);
  let expiredCount = 0;

  appState.inventory.forEach(item => {
    if (item.category !== 'producto_terminado') return;
    const days = daysUntilExpiry(item.expiry);
    if (days <= 0 && item.stock > 0) {
      const costLost = Math.round(item.stock * item.unitCost);
      // Register in wastes
      appState.wastes.unshift({
        date: new Date().toLocaleDateString('es-CR'),
        product: item.name,
        qty: `${item.stock} ${item.unit}`,
        type: 'Pérdida / Vencimiento Registrado',
        cost: costLost
      });
      // Audit trace
      appState.auditLogs.unshift({
        time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        user: 'Sistema Automático',
        role: 'Control de Vencimientos',
        module: 'Inventario y Stock',
        action: `Pérdida / Vencimiento Registrado: ${item.stock} ${item.unit} de "${item.name}" → Costo ₡${formatNumber(costLost)}`,
        ip: '192.168.1.10'
      });
      item.stock   = 0;
      item.status  = 'critico';
      expiredCount += 1;
    }
  });

  if (expiredCount > 0) {
    saveState();
    showToast(
      `⚠️ ${expiredCount} producto(s) vencido(s) registrado(s) como pérdida automáticamente.`,
      'warning'
    );
  }
  return expiredCount;
}

// ==========================================
// 1. INITIAL SEED STATE & REACTIVE STORE (COSTA RICA - CRC)
// ==========================================
const DB_KEY = 'bakemaster_erp_data_cr_v2';

const DEFAULT_STATE = {
  activeBranch: 'central',
  currentUser: {
    name: 'Carlos Mendoza',
    roleTitle: 'Maestro Panadero / Propietario',
    roleKey: 'admin'
  },
  cashRegister: {
    status: 'open',
    openedAt: '06:00 AM',
    initialFloat: 50000,
    cashSales: 285400,
    electronicSales: 327100,
    expenses: 15000,
    movements: [
      { time: '06:00 AM', type: 'Apertura', desc: 'Fondo Inicial de Caja Turno Mañana', amount: 50000, user: 'Carlos M.' },
      { time: '08:15 AM', type: 'Egreso', desc: 'Compra urgente levadura seca (Distribuidora El Grano)', amount: -10000, user: 'Valentina R.' },
      { time: '10:30 AM', type: 'Egreso', desc: 'Pago mensajería Express local', amount: -5000, user: 'Carlos M.' }
    ]
  },
  inventory: [
    { id: 'INV-001', code: 'MP-001', name: 'Harina de Trigo Especial Fuerza (W300)', category: 'materia_prima', stock: 18.5, minStock: 50, unit: 'kg', unitCost: 850, lot: 'L-9942', expiry: '2026-11-20', status: 'critico' },
    { id: 'INV-002', code: 'MP-002', name: 'Mantequilla Pura 84% Grasa', category: 'materia_prima', stock: 12.0, minStock: 15, unit: 'kg', unitCost: 6500, lot: 'L-8841', expiry: '2026-08-20', status: 'por_vencer' },
    { id: 'INV-003', code: 'MP-003', name: 'Levadura Fresca Prensada', category: 'materia_prima', stock: 8.0, minStock: 5, unit: 'kg', unitCost: 2200, lot: 'L-7712', expiry: '2026-08-30', status: 'optimo' },
    { id: 'INV-004', code: 'MP-004', name: 'Chocolate Gourmet 70% Gotas', category: 'materia_prima', stock: 22.0, minStock: 10, unit: 'kg', unitCost: 11500, lot: 'L-5521', expiry: '2027-02-15', status: 'optimo' },
    { id: 'INV-005', code: 'MP-005', name: 'Azúcar Doña María Refinada Extra', category: 'materia_prima', stock: 85.0, minStock: 30, unit: 'kg', unitCost: 950, lot: 'L-4410', expiry: '2027-05-10', status: 'optimo' },
    { id: 'INV-006', code: 'PT-001', name: 'Croissant Francés de Mantequilla', category: 'producto_terminado', stock: 34, minStock: 15, unit: 'un', unitCost: 480, pvp: 1600, lot: 'OP-089', expiry: '2026-08-18', status: 'optimo', img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80' },
    { id: 'INV-007', code: 'PT-002', name: 'Baguette Rústico Masa Madre', category: 'producto_terminado', stock: 45, minStock: 20, unit: 'un', unitCost: 350, pvp: 1200, lot: 'OP-088', expiry: '2026-08-18', status: 'optimo', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80' },
    { id: 'INV-008', code: 'PT-003', name: 'Pan Campesino Sourdough (500g)', category: 'producto_terminado', stock: 12, minStock: 10, unit: 'un', unitCost: 850, pvp: 3200, lot: 'OP-087', expiry: '2026-08-20', status: 'optimo', img: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&auto=format&fit=crop&q=80' },
    { id: 'INV-009', code: 'PT-004', name: 'Tarta Selva Negra Gourmet (Porción)', category: 'producto_terminado', stock: 8, minStock: 6, unit: 'un', unitCost: 1100, pvp: 2800, lot: 'OP-086', expiry: '2026-08-19', status: 'optimo', img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80' },
    { id: 'INV-010', code: 'PT-005', name: 'Café Espresso Doble Tarrazú', category: 'producto_terminado', stock: 100, minStock: 20, unit: 'un', unitCost: 350, pvp: 1500, lot: 'CF-01', expiry: '2026-12-31', status: 'optimo', img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80' },
    { id: 'INV-011', code: 'EMP-001', name: 'Bolsas Kraft Biodegradables para Pan', category: 'empaque', stock: 450, minStock: 200, unit: 'un', unitCost: 45, lot: 'EM-112', expiry: '2028-01-01', status: 'optimo' },
    { id: 'INV-012', code: 'EMP-002', name: 'Cajas para Tarta 25x25 cm', category: 'empaque', stock: 35, minStock: 50, unit: 'un', unitCost: 320, lot: 'EM-115', expiry: '2028-01-01', status: 'critico' }
  ],
  recipes: [
    {
      id: 'REC-001',
      name: 'Croissant Francés de Mantequilla',
      category: 'panaderia',
      baseYield: 40,
      pvp: 1600,
      bakeTimeMin: 18,
      bakeTempC: 195,
      desc: 'Masa hojaldrada tradicional con fermentación en frío de 18 horas y 100% mantequilla de alta grasa.',
      energyCost: 1500,
      laborCost: 2500,
      ingredients: [
        { name: 'Harina de Trigo Especial Fuerza', qtyKg: 2.0, unitCost: 850, bakerPercent: '100%' },
        { name: 'Mantequilla Pura 84%', qtyKg: 1.1, unitCost: 6500, bakerPercent: '55%' },
        { name: 'Azúcar Refinada Extra', qtyKg: 0.25, unitCost: 950, bakerPercent: '12.5%' },
        { name: 'Levadura Fresca Prensada', qtyKg: 0.08, unitCost: 2200, bakerPercent: '4%' },
        { name: 'Sal Marina Fina', qtyKg: 0.04, unitCost: 400, bakerPercent: '2%' },
        { name: 'Agua Filtrada & Leche', qtyKg: 1.0, unitCost: 500, bakerPercent: '50%' }
      ]
    },
    {
      id: 'REC-002',
      name: 'Baguette Rústico Tradicional',
      category: 'panaderia',
      baseYield: 30,
      pvp: 1200,
      bakeTimeMin: 22,
      bakeTempC: 230,
      desc: 'Baguette de fermentación lenta (poolish) con corteza crocante y alveolado pronunciado.',
      energyCost: 1200,
      laborCost: 1800,
      ingredients: [
        { name: 'Harina de Trigo Especial Fuerza', qtyKg: 3.5, unitCost: 850, bakerPercent: '100%' },
        { name: 'Agua Filtrada Fría', qtyKg: 2.45, unitCost: 150, bakerPercent: '70%' },
        { name: 'Masa Madre Activa', qtyKg: 0.7, unitCost: 600, bakerPercent: '20%' },
        { name: 'Sal Marina Fina', qtyKg: 0.07, unitCost: 400, bakerPercent: '2%' },
        { name: 'Levadura Fresca', qtyKg: 0.02, unitCost: 2200, bakerPercent: '0.5%' }
      ]
    },
    {
      id: 'REC-003',
      name: 'Pan de Masa Madre (Sourdough 500g)',
      category: 'panaderia',
      baseYield: 20,
      pvp: 3200,
      bakeTimeMin: 35,
      bakeTempC: 240,
      desc: 'Hogaza rústica 100% natural sin levadura comercial, fermentada 24 horas.',
      energyCost: 1800,
      laborCost: 2800,
      ingredients: [
        { name: 'Harina de Trigo Especial Fuerza', qtyKg: 4.0, unitCost: 850, bakerPercent: '80%' },
        { name: 'Harina Integral de Centeno', qtyKg: 1.0, unitCost: 1600, bakerPercent: '20%' },
        { name: 'Agua Filtrada', qtyKg: 3.8, unitCost: 150, bakerPercent: '76%' },
        { name: 'Masa Madre Líquida (Levain)', qtyKg: 1.0, unitCost: 700, bakerPercent: '20%' },
        { name: 'Sal Marina', qtyKg: 0.1, unitCost: 400, bakerPercent: '2%' }
      ]
    },
    {
      id: 'REC-004',
      name: 'Tarta Selva Negra Artesanal (8 Porciones)',
      category: 'reposteria',
      baseYield: 16,
      pvp: 2800,
      bakeTimeMin: 30,
      bakeTempC: 175,
      desc: 'Bizcocho húmedo de cacao con cerezas amarenas, crema chantilly fresca y virutas de chocolate 70%.',
      energyCost: 1500,
      laborCost: 3500,
      ingredients: [
        { name: 'Chocolate Gourmet 70% Gotas', qtyKg: 0.6, unitCost: 11500, bakerPercent: '30%' },
        { name: 'Harina Repostería', qtyKg: 0.8, unitCost: 950, bakerPercent: '40%' },
        { name: 'Crema de Leche Fresca', qtyKg: 1.2, unitCost: 4200, bakerPercent: '60%' },
        { name: 'Cerezas Amarenas', qtyKg: 0.4, unitCost: 8500, bakerPercent: '20%' },
        { name: 'Azúcar Refinada Extra', qtyKg: 0.6, unitCost: 950, bakerPercent: '30%' }
      ]
    }
  ],
  productionOrders: [
    { id: 'OP-2024-090', recipe: 'Pan de Masa Madre (Sourdough)', units: 45, startTime: '10:00 AM', baker: 'Javier Beltrán', status: 'En Horno' },
    { id: 'OP-2024-091', recipe: 'Brioche Trenzado de Canela', units: 35, startTime: '02:30 PM', baker: 'Carlos Mendoza', status: 'En Fermentación' },
    { id: 'OP-2024-092', recipe: 'Tarta Rústica de Frutos Rojos', units: 15, startTime: '04:00 PM', baker: 'Valentina Ríos', status: 'Programada' }
  ],
  wastes: [
    { date: 'Hoy 07:15 AM', product: 'Croissant Francés', qty: '4 un', type: 'Horneado (Tostado excesivo)', cost: 1920 },
    { date: 'Hoy 09:30 AM', product: 'Baguette Rústico', qty: '2 un', type: 'Masa deforme en formado', cost: 700 },
    { date: 'Ayer 06:45 PM', product: 'Tarta Frutos Rojos', qty: '1 porción', type: 'No vendida en mostrador', cost: 1100 }
  ],
  suppliers: [
    { name: 'Molinera de Costa Rica S.A.', category: 'Harinas y Granos', contact: '+506 2221-4500', rating: '⭐⭐⭐⭐⭐ (A+)', terms: 'Crédito 30 días' },
    { name: 'Cooperativa Dos Pinos / Monteverde', category: 'Grasas, Mantequillas & Lácteos', contact: '+506 2437-3000', rating: '⭐⭐⭐⭐⭐ (A+)', terms: 'Contado / 15 días' },
    { name: 'Cacao & Chocolates Britt Costa Rica', category: 'Chocolates & Coberturas', contact: '+506 2277-1500', rating: '⭐⭐⭐⭐ (A)', terms: 'Crédito 15 días' },
    { name: 'Empaques Ecológicos del Valle', category: 'Cajas & Bolsas Kraft', contact: '+506 2290-7800', rating: '⭐⭐⭐⭐ (A)', terms: 'Contado' }
  ],
  customers: [
    { id: 1, name: 'Cliente Mostrador (Genérico)', phone: 'N/A', tier: 'Estándar', points: 0, totalSpent: 1250000, lastVisit: 'Hoy' },
    { id: 2, name: 'María Fernanda Gómez', phone: '+506 8845-1234', tier: 'Plata ⭐⭐', points: 450, totalSpent: 385000, lastVisit: 'Hoy' },
    { id: 3, name: 'Restaurante Bistro San Rafael (Escazú)', phone: '+506 2289-9988', tier: 'Corporativo VIP 👑', points: 3400, totalSpent: 2450000, lastVisit: 'Ayer' },
    { id: 4, name: 'Juan Camilo Pardo', phone: '+506 8712-5432', tier: 'Oro ⭐⭐⭐', points: 1200, totalSpent: 620000, lastVisit: 'Hace 2 días' }
  ],
  deliveries: [
    { id: 'DEL-1043', client: 'Café Bistro San Rafael', address: 'Escazú Centro, 200m Sur de la Iglesia', items: '40 Croissants, 20 Baguettes', status: 'Entregado', driver: 'Andrés Villa', eta: '08:45 AM' },
    { id: 'DEL-1044', client: 'Hotel Boutique Grano de Oro', address: 'Paseo Colón, Calle 30', items: '80 Panecillos Brioche, 30 Sourdough', status: 'En Camino (10 min)', driver: 'Andrés Villa', eta: '10:15 AM' },
    { id: 'DEL-1045', client: 'Restaurante La Casona Gourmet', address: 'Santa Ana, Plaza Antigua', items: '15 Tartas Gourmet, 25 Baguettes', status: 'En Preparación', driver: 'Marlon Duque', eta: '11:45 AM' }
  ],
  auditLogs: [
    { time: '12:00:15 PM', user: 'Carlos Mendoza', role: 'Admin', module: 'POS / Ventas', action: 'Venta Ticket #1048 por ₡9,500 (SINPE Móvil)', ip: '192.168.1.10' },
    { time: '11:42:00 AM', user: 'Javier Beltrán', role: 'Maestro Panadero', module: 'Producción', action: 'Lanzada Orden OP-2024-090 (45 Pan de Masa Madre)', ip: '192.168.1.15' },
    { time: '10:30:10 AM', user: 'Carlos Mendoza', role: 'Admin', module: 'Caja', action: 'Registro de Egreso ₡5,000 (Mensajería Express)', ip: '192.168.1.10' },
    { time: '08:15:22 AM', user: 'Valentina Ríos', role: 'Cajera', module: 'Caja', action: 'Registro de Egreso ₡10,000 (Levadura fresca urgente)', ip: '192.168.1.12' },
    { time: '06:00:00 AM', user: 'Carlos Mendoza', role: 'Admin', module: 'Caja', action: 'Apertura de Caja #01 con ₡50,000', ip: '192.168.1.10' }
  ]
};

// ==========================================
// 1.1 GOOGLE FIREBASE CLOUD FIRESTORE INTEGRATION
// Proyecto: "Panaderia de Carlos y Ana"
// Motor de sincronización en tiempo real con persistencia offline-first
// ==========================================
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDyxMAcLGzfYkBbRZlI8fKVGRYXMYjoIVM",
  authDomain: "panaderia-de-carlos-y-ana.firebaseapp.com",
  projectId: "panaderia-de-carlos-y-ana",
  storageBucket: "panaderia-de-carlos-y-ana.appspot.com",
  messagingSenderId: "1098234812",
  appId: "1:1098234812:web:98f12a3b4c5d6e7f"
};

let firestoreDB = null;
let isFirebaseOnline = false;
let firebaseLastSyncTime = null;
let firebaseInitRetries = 0;
const FIREBASE_MAX_RETRIES = 3;
// Track active onSnapshot listeners so we can tear down on re-init
let _firestoreUnsubscribers = [];

function getStoredFirebaseConfig() {
  const stored = localStorage.getItem('bakemaster_firebase_custom_config');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { /* corrupt — fall through */ }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Initializes Firebase App + Firestore, enables offline persistence,
 * sets up real-time onSnapshot listeners, and updates the UI badge.
 */
function initFirebaseFirestore() {
  try {
    const config = getStoredFirebaseConfig();

    // Populate modal inputs if they exist
    const projIdInput = document.getElementById('fbConfigProjectId');
    const apiKeyInput = document.getElementById('fbConfigApiKey');
    if (projIdInput) projIdInput.value = config.projectId;
    if (apiKeyInput) apiKeyInput.value = config.apiKey;

    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK no cargado. Modo offline únicamente.');
      updateFirebaseUIStatus('offline');
      return;
    }

    // Initialize or reuse the Firebase App
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    firestoreDB = firebase.firestore();

    // Enable Firestore offline persistence (cache-first, works without network)
    firestoreDB.enablePersistence({ synchronizeTabs: true })
      .then(() => console.log('💾 Firestore persistencia offline habilitada'))
      .catch(err => {
        if (err.code === 'failed-precondition')  console.warn('Persistencia: múltiples pestañas abiertas, solo una puede usar caché.');
        else if (err.code === 'unimplemented') console.warn('Persistencia: este navegador no la soporta.');
      });

    // ── Connection-state probe ──
    // We do a lightweight read to confirm the credentials & project are valid.
    firestoreDB.collection('_ping').doc('status').set({
      alive: true,
      project: 'Panaderia de Carlos y Ana',
      lastPing: new Date().toISOString()
    }).then(() => {
      isFirebaseOnline = true;
      firebaseInitRetries = 0;
      updateFirebaseUIStatus('online');
      console.log('🔥 Firebase Firestore conectado → Proyecto: ' + config.projectId);

      // Do an initial full sync from local → cloud
      syncStateToFirestore();

      // Attach real-time listeners to pull remote changes
      attachFirestoreListeners();
    }).catch(err => {
      console.error('❌ Firebase conexión fallida:', err.message || err);
      isFirebaseOnline = false;
      updateFirebaseUIStatus('error', err.code || err.message);

      // Auto-retry up to N times with exponential backoff
      if (firebaseInitRetries < FIREBASE_MAX_RETRIES) {
        firebaseInitRetries++;
        const delay = 3000 * firebaseInitRetries;
        console.log(`🔄 Reintentando conexión Firebase en ${delay / 1000}s (intento ${firebaseInitRetries}/${FIREBASE_MAX_RETRIES})…`);
        setTimeout(initFirebaseFirestore, delay);
      }
    });

  } catch (err) {
    console.error('Firebase init error:', err);
    updateFirebaseUIStatus('error', err.message);
  }
}

/**
 * Attaches Firestore onSnapshot listeners so remote edits
 * (e.g. from another device) are pulled into local state automatically.
 */
function attachFirestoreListeners() {
  if (!firestoreDB) return;

  // Tear down any previous listeners
  _firestoreUnsubscribers.forEach(fn => fn());
  _firestoreUnsubscribers = [];

  // ── Almacén de Ingredientes ──
  _firestoreUnsubscribers.push(
    firestoreDB.collection('almacen_ingredientes').doc('actual')
      .onSnapshot({ includeMetadataChanges: true }, snap => {
        if (!snap.exists) return;
        const data = snap.data();
        // Only merge if the cloud timestamp is newer than our last sync
        if (data.lastUpdated && firebaseLastSyncTime && data.lastUpdated > firebaseLastSyncTime) {
          // Cloud has newer data — merge into local
          if (Array.isArray(data.items)) {
            appState.inventory = data.items;
            localStorage.setItem(DB_KEY, JSON.stringify(appState));
            renderAll();
            console.log('☁️→📱 Almacén actualizado desde la nube');
          }
        }
        updateSyncBadgeTimestamp(data.lastUpdated);
      })
  );

  // ── Caja / Turnos ──
  _firestoreUnsubscribers.push(
    firestoreDB.collection('caja_turnos').doc('turno_actual')
      .onSnapshot({ includeMetadataChanges: true }, snap => {
        if (!snap.exists) return;
        const data = snap.data();
        if (data.lastUpdated && firebaseLastSyncTime && data.lastUpdated > firebaseLastSyncTime) {
          if (data.cashRegister) {
            appState.cashRegister = data.cashRegister;
            localStorage.setItem(DB_KEY, JSON.stringify(appState));
            renderAll();
            console.log('☁️→📱 Caja actualizada desde la nube');
          }
        }
        updateSyncBadgeTimestamp(data.lastUpdated);
      })
  );

  // ── Turnos de Horno ──
  _firestoreUnsubscribers.push(
    firestoreDB.collection('turnos_horno').doc('horno_activo')
      .onSnapshot({ includeMetadataChanges: true }, snap => {
        if (!snap.exists) return;
        const data = snap.data();
        if (data.lastUpdated && firebaseLastSyncTime && data.lastUpdated > firebaseLastSyncTime) {
          if (Array.isArray(data.orders)) {
            appState.productionOrders = data.orders;
            localStorage.setItem(DB_KEY, JSON.stringify(appState));
            renderAll();
            console.log('☁️→📱 Turnos de horno actualizados desde la nube');
          }
        }
        updateSyncBadgeTimestamp(data.lastUpdated);
      })
  );

  console.log('👂 Listeners en tiempo real activos: almacen, caja, horno');
}

/** Update the small timestamp shown in the Firebase pill */
function updateSyncBadgeTimestamp(isoStr) {
  if (!isoStr) return;
  const el = document.getElementById('firebaseLastSync');
  if (el) {
    const d = new Date(isoStr);
    el.textContent = 'Última sync: ' + d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

/**
 * Save custom Firebase credentials from the modal,
 * then tear down and reinitialize with the new config.
 */
function saveCustomFirebaseConfig() {
  const projectId = document.getElementById('fbConfigProjectId')?.value.trim() || DEFAULT_FIREBASE_CONFIG.projectId;
  const apiKey    = document.getElementById('fbConfigApiKey')?.value.trim()    || DEFAULT_FIREBASE_CONFIG.apiKey;

  const newConfig = {
    ...DEFAULT_FIREBASE_CONFIG,
    projectId,
    authDomain: `${projectId}.firebaseapp.com`,
    storageBucket: `${projectId}.appspot.com`,
    apiKey
  };

  localStorage.setItem('bakemaster_firebase_custom_config', JSON.stringify(newConfig));

  showToast('💾 Credenciales guardadas. Reconectando con Firestore…', 'success');
  closeModal('firebaseSyncModal');

  // Tear down current listeners & app, then reinitialize
  _firestoreUnsubscribers.forEach(fn => fn());
  _firestoreUnsubscribers = [];
  firestoreDB = null;
  isFirebaseOnline = false;
  firebaseInitRetries = 0;

  // Delete existing Firebase app so initializeApp uses new config
  if (typeof firebase !== 'undefined' && firebase.apps.length) {
    firebase.apps.forEach(app => app.delete());
  }

  // Re-init after a short breath
  setTimeout(() => initFirebaseFirestore(), 500);
}

/**
 * Updates the Firebase status pill in the top bar.
 * @param {'online'|'offline'|'error'} status
 * @param {string} [detail]
 */
function updateFirebaseUIStatus(status, detail) {
  const pill = document.getElementById('firebaseStatusPill');
  const text = document.getElementById('firebaseStatusText');
  if (!pill || !text) return;

  // Clear previous state classes
  pill.classList.remove('online', 'offline', 'error');

  if (status === 'online') {
    pill.classList.add('online');
    text.textContent = '☁️ Firebase: Panaderia de Carlos y Ana';
  } else if (status === 'error') {
    pill.classList.add('error');
    text.textContent = '⚠️ Firebase: error de conexión';
    console.warn('Firebase UI status → error:', detail);
  } else {
    pill.classList.add('offline');
    text.textContent = '📴 Firebase: sin conexión';
  }
}

/**
 * Record a single sale document in the `ventas` collection.
 */
function firestoreRecordSale(saleData) {
  if (!firestoreDB) return;
  try {
    firestoreDB.collection('ventas').add({
      ...saleData,
      project: 'Panaderia de Carlos y Ana',
      sucursal: appState.activeBranch || 'central',
      createdAt: new Date().toISOString()
    }).then(() => {
      console.log('🔥 Venta registrada en Firestore:', saleData.ticketNum);
    }).catch(err => {
      console.warn('Error al guardar venta en Firestore:', err);
    });
  } catch (e) {
    console.warn('Firestore sale fallback (offline cache):', e);
  }
}

/**
 * Debounced sync of all master collections from local → Firestore.
 * Called automatically every time saveState() runs.
 */
let syncDebounceTimer = null;
function syncStateToFirestore() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    if (!firestoreDB) return;

    const now = new Date().toISOString();
    firebaseLastSyncTime = now;

    const batch = firestoreDB.batch();

    // ── Almacén ──
    const almacenRef = firestoreDB.collection('almacen_ingredientes').doc('actual');
    batch.set(almacenRef, {
      project: 'Panaderia de Carlos y Ana',
      items: appState.inventory,
      lastUpdated: now
    }, { merge: true });

    // ── Caja / Turnos ──
    const cajaRef = firestoreDB.collection('caja_turnos').doc('turno_actual');
    batch.set(cajaRef, {
      project: 'Panaderia de Carlos y Ana',
      cashRegister: appState.cashRegister,
      lastUpdated: now
    }, { merge: true });

    // ── Turnos de Horno ──
    const hornoRef = firestoreDB.collection('turnos_horno').doc('horno_activo');
    batch.set(hornoRef, {
      project: 'Panaderia de Carlos y Ana',
      orders: appState.productionOrders,
      lastUpdated: now
    }, { merge: true });

    // ── Auditoría (últimos 50 registros) ──
    const auditRef = firestoreDB.collection('auditoria_logs').doc('hoy');
    batch.set(auditRef, {
      project: 'Panaderia de Carlos y Ana',
      logs: appState.auditLogs.slice(0, 50),
      lastUpdated: now
    }, { merge: true });

    // Commit batch atomically
    batch.commit()
      .then(() => {
        updateSyncBadgeTimestamp(now);
        console.log('✅ Sync completa con Firestore:', now);
      })
      .catch(err => {
        console.warn('⚠️ Sync batch error (datos cacheados offline):', err);
      });

  }, 300);
}

/**
 * Force a full sync right now (user-triggered from modal button).
 */
function forceFirebaseCloudSync() {
  // Ensure latest local state is persisted first
  localStorage.setItem(DB_KEY, JSON.stringify(appState));

  if (!firestoreDB) {
    showToast('⚠️ Firebase no está conectado. Revisa tus credenciales en el modal de configuración.', 'warning');
    return;
  }

  // Clear debounce and force immediate
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = null;

  const now = new Date().toISOString();
  firebaseLastSyncTime = now;

  const batch = firestoreDB.batch();

  batch.set(firestoreDB.collection('almacen_ingredientes').doc('actual'), {
    project: 'Panaderia de Carlos y Ana', items: appState.inventory, lastUpdated: now
  }, { merge: true });

  batch.set(firestoreDB.collection('caja_turnos').doc('turno_actual'), {
    project: 'Panaderia de Carlos y Ana', cashRegister: appState.cashRegister, lastUpdated: now
  }, { merge: true });

  batch.set(firestoreDB.collection('turnos_horno').doc('horno_activo'), {
    project: 'Panaderia de Carlos y Ana', orders: appState.productionOrders, lastUpdated: now
  }, { merge: true });

  batch.set(firestoreDB.collection('auditoria_logs').doc('hoy'), {
    project: 'Panaderia de Carlos y Ana', logs: appState.auditLogs.slice(0, 50), lastUpdated: now
  }, { merge: true });

  batch.commit()
    .then(() => {
      updateSyncBadgeTimestamp(now);
      if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 70 });
      showToast('☁️ ¡Sincronización completa con Firebase Cloud Firestore realizada con éxito!', 'success');
      closeModal('firebaseSyncModal');
    })
    .catch(err => {
      showToast('⚠️ Error al sincronizar: ' + (err.message || err), 'error');
      console.error('Force sync error:', err);
    });
}

// ==========================================
// 1.2 BASE DE USUARIOS Y CONTROL DE PIN
// ==========================================
const USERS_DB = {
  admin: {
    key: 'admin',
    name: 'Carlos Mendoza',
    roleTitle: 'Dueño / Administrador',
    roleKey: 'admin',
    pin: '1234',
    bodyClass: 'role-admin',
    homeView: 'dashboard',
    avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&auto=format&fit=crop&q=80'
  },
  cajero: {
    key: 'cajero',
    name: 'Valentina Ríos',
    roleTitle: 'Atención Mostrador & Caja',
    roleKey: 'cajero',
    pin: '2222',
    bodyClass: 'role-mostrador',
    homeView: 'pos',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80'
  },
  chef: {
    key: 'chef',
    name: 'Javier Beltrán',
    roleTitle: 'Maestro Panadero & Obrador',
    roleKey: 'chef',
    pin: '3333',
    bodyClass: 'role-panadero',
    homeView: 'produccion',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&auto=format&fit=crop&q=80'
  },
  logistica: {
    key: 'logistica',
    name: 'Andrés Villa',
    roleTitle: 'Repartidor & Envíos',
    roleKey: 'logistica',
    pin: '4444',
    bodyClass: 'role-repartidor',
    homeView: 'logistica',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'
  }
};

let activeLockUserKey = 'admin';
let enteredPinDigits = '';

function showLockScreen() {
  const portal = document.getElementById('loginPortalOverlay');
  const lock = document.getElementById('pinLockScreenOverlay');
  if (portal) { portal.classList.add('show'); portal.style.display = 'flex'; }
  if (lock) { lock.classList.add('show'); lock.style.display = 'flex'; }
  clearPinInput();
  selectLockUser(appState.currentUser?.roleKey || 'admin');
  lucide.createIcons();
}

function hideLockScreen() {
  const portal = document.getElementById('loginPortalOverlay');
  const lock = document.getElementById('pinLockScreenOverlay');
  if (portal) { portal.classList.remove('show'); portal.style.display = 'none'; }
  if (lock) { lock.classList.remove('show'); lock.style.display = 'none'; }
  clearPinInput();
}

function selectLockUser(userKey) {
  activeLockUserKey = userKey;
  document.querySelectorAll('.pin-user-card').forEach(card => {
    if (card.getAttribute('data-user') === userKey) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
  clearPinInput();
}

function enterPinDigit(digit) {
  if (enteredPinDigits.length >= 4) return;
  enteredPinDigits += digit;
  updatePinDots();

  if (enteredPinDigits.length === 4) {
    setTimeout(submitPinLogin, 120);
  }
}

function clearPinInput() {
  enteredPinDigits = '';
  updatePinDots();
  const errEl = document.getElementById('pinErrorMsg');
  if (errEl) errEl.textContent = '';
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pinDotsDisplay .pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < enteredPinDigits.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function submitPinLogin() {
  const user = USERS_DB[activeLockUserKey];
  const errEl = document.getElementById('pinErrorMsg');

  if (user && enteredPinDigits === user.pin) {
    applyRoleAccessRules(user);
    hideLockScreen();
    showToast(`👋 ¡Bienvenido/a, ${user.name}! (${user.roleTitle})`, 'success');
  } else {
    if (errEl) errEl.textContent = '❌ PIN incorrecto. Intenta de nuevo.';
    enteredPinDigits = '';
    updatePinDots();
  }
}

function unlockQuickUser(userKey) {
  const user = USERS_DB[userKey || 'admin'];
  if (user) {
    applyRoleAccessRules(user);
    hideLockScreen();
    showToast(`⚡ Acceso Rápido: ${user.name} (${user.roleTitle})`, 'info');
  }
}

function applyRoleAccessRules(user) {
  const isIsolatedTenant = user.isNewTenant || (user.tenantId && user.tenantId !== 'demo_carlos_ana');

  appState.currentUser = {
    name: user.name,
    roleTitle: user.roleTitle,
    roleKey: user.roleKey,
    tenantId: user.tenantId || 'demo_carlos_ana',
    isNewTenant: isIsolatedTenant
  };

  // ── Multi-Tenant Isolation ──
  if (isIsolatedTenant) {
    // Isolated tenant scope: load clean blank database for this merchant
    const tenantKey = `bakemaster_erp_data_${user.tenantId}`;
    const savedTenant = localStorage.getItem(tenantKey);
    if (savedTenant) {
      try {
        const parsed = JSON.parse(savedTenant);
        appState.inventory = parsed.inventory || [];
        appState.recipes = parsed.recipes || [];
        appState.cashRegister = parsed.cashRegister || { status: 'open', initialFloat: 0, cashSales: 0, movements: [] };
      } catch (e) { /* clean fallback */ }
    } else {
      // Clean slate (0 products, 0 recipes, empty cash movements)
      appState.inventory = [];
      appState.recipes = [];
      appState.cashRegister = {
        status: 'open',
        openedAt: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
        initialFloat: 0,
        cashSales: 0,
        electronicSales: 0,
        expenses: 0,
        movements: []
      };
      localStorage.setItem(tenantKey, JSON.stringify(appState));
    }

    // Adapt brand name for the tenant
    const bName = user.businessName || user.name;
    const brandSub = document.querySelector('.brand-subtitle');
    if (brandSub) brandSub.textContent = bName;
  } else {
    // Default Demo Tenant: Restore Carlos y Ana demo database if switching back
    const defaultSaved = localStorage.getItem(DB_KEY);
    if (defaultSaved) {
      try {
        const parsed = JSON.parse(defaultSaved);
        appState.inventory = parsed.inventory || DEFAULT_STATE.inventory;
        appState.recipes = parsed.recipes || DEFAULT_STATE.recipes;
        appState.cashRegister = parsed.cashRegister || DEFAULT_STATE.cashRegister;
      } catch (e) {}
    }
    const brandSub = document.querySelector('.brand-subtitle');
    if (brandSub) brandSub.textContent = 'Panaderia de Carlos y Ana';
  }

  // Update body class for role-based CSS filtering
  document.body.className = `theme-light mode-obrador ${user.bodyClass}`;

  // Update User info in UI
  const nameEl = document.getElementById('currentUserName');
  if (nameEl) nameEl.textContent = user.name;
  const roleEl = document.getElementById('currentUserRole');
  if (roleEl) roleEl.textContent = user.roleTitle;
  const cashierEl = document.getElementById('posCashierName');
  if (cashierEl) cashierEl.textContent = user.name;
  const avatarEl = document.getElementById('sidebarUserImg');
  if (avatarEl) avatarEl.src = user.avatar;

  saveState();

  // Navigate automatically to primary role view
  navigateTo(user.homeView);
}

// Load state from localStorage or initialize
let appState = (() => {
  const saved = localStorage.getItem(DB_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { console.error(e); }
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
})();

function saveState() {
  localStorage.setItem(DB_KEY, JSON.stringify(appState));
  syncStateToFirestore();
}

// POS Cart State
let currentCart = [];
let selectedPaymentMethod = 'efectivo';
let activeRecipeIndex = 0;

// ==========================================
// 2. NAVIGATION & ROUTING
// ==========================================
function initNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      navigateTo(targetView);
    });
  });

  // Sidebar Collapse Toggle
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebar = document.getElementById('sidebar');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      collapseBtn.innerHTML = isCollapsed ? '<i data-lucide="chevrons-right"></i>' : '<i data-lucide="chevrons-left"></i>';
      lucide.createIcons();
    });
  }

  // Mobile Menu Toggle
  const mobileBtn = document.getElementById('mobileMenuBtn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Notifications Toggle
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      notifDropdown.classList.remove('show');
    });
  }

  // Subnav Tabs in Producción
  const subnavTabs = document.querySelectorAll('.subnav-tab');
  subnavTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subnavTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.querySelectorAll('.subview-container').forEach(c => c.classList.remove('active'));
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Quick sale button
  document.getElementById('btnQuickSale')?.addEventListener('click', () => navigateTo('pos'));

  // Role Switcher Modal
  document.getElementById('roleSwitchBtn')?.addEventListener('click', () => {
    openModal('roleSwitchModal');
  });
}

function navigateTo(viewName) {
  // Security protection for SuperAdmin view
  if (viewName === 'superadmin' && !_saIsLoggedIn) {
    showToast('⚠️ Acceso protegido. Ingresa como SuperAdmin.', 'warning');
    openSuperAdminLogin();
    return;
  }

  // Update nav links
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all views & show target
  document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
  const targetEl = document.getElementById(`view-${viewName}`);
  if (targetEl) {
    targetEl.classList.add('active');
  }

  // Update Breadcrumb Title
  const titles = {
    'dashboard': 'Resumen del Día & Panel Principal',
    'pos': 'Punto de Venta (Cobrar)',
    'produccion': 'Producción & Recetas del Obrador',
    'inventario': 'Inventario, Materias Primas & Stock',
    'compras': 'Compras a Proveedores & Pedidos',
    'caja': 'Caja, Dinero en Turno & Arqueo',
    'logistica': 'Envíos, Despachos & Rutas',
    'crm': 'Clientes Frecuentes & Puntos',
    'ia-assistant': 'Asistente Inteligente (PanaderIA)',
    'auditoria': 'Historial, Auditoría & Seguridad',
    'superadmin': 'Panel de Control SuperAdmin Global',
    'hardware': 'Configuración de Periféricos & Hardware POS'
  };
  const titleEl = document.getElementById('viewTitle');
  if (titleEl) titleEl.textContent = titles[viewName] || 'BakeMaster ERP';

  // Render content dynamically
  if (viewName === 'dashboard') renderDashboardCharts();
  if (viewName === 'pos') renderPOSCatalog();
  if (viewName === 'produccion') renderRecipeMasterList();
  if (viewName === 'inventario') renderInventoryTable();
  if (viewName === 'caja') renderCashRegisterView();
  if (viewName === 'logistica') renderLogisticsView();
  if (viewName === 'crm') renderCRMView();
  if (viewName === 'ia-assistant') renderAISnapshotBar();
  if (viewName === 'auditoria') renderAuditLogs();
  if (viewName === 'superadmin') renderSuperAdminPanel();
  if (viewName === 'hardware') initHardwareSettingsUI();

  // Close mobile menu if open
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  lucide.createIcons();
}


// ==========================================
// 3. CLOCK & LIVE BADGES
// ==========================================
function initSystemClock() {
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const clockEl = document.getElementById('liveTime');
    if (clockEl) clockEl.textContent = timeStr;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// ==========================================
// MODO DE PERFIL (OBRADOR OPERATIVO vs MODO DUEÑO)
// ==========================================
function setProfileMode(mode) {
  appState.profileMode = mode;
  if (mode === 'obrador') {
    document.body.classList.add('mode-obrador');
    document.getElementById('btnProfileObrador')?.classList.add('active');
    document.getElementById('btnProfileAdmin')?.classList.remove('active');
    showToast('🧑‍🍳 Modo Obrador Operativo activo: Interfaz simplificada', 'success');
  } else {
    document.body.classList.remove('mode-obrador');
    document.getElementById('btnProfileObrador')?.classList.remove('active');
    document.getElementById('btnProfileAdmin')?.classList.add('active');
    showToast('👑 Modo Dueño / Administrador activo: Visibilidad total del ERP', 'info');
  }
  saveState();
}

// ==========================================
// RESUMEN MATUTINO PROACTIVO DE PANADERIA (CON AUDIO TTS)
// ==========================================
let isSpeakingMorning = false;

function renderMorningSummary() {
  const container = document.getElementById('morningSummaryContent');
  if (!container) return;

  const harina = appState.inventory.find(i => i.code === 'MP-001') || { stock: 18.5, minStock: 50 };
  const netCash = appState.cashRegister.initialFloat + appState.cashRegister.cashSales - appState.cashRegister.expenses;

  container.innerHTML = `
    <p>¡Buenos días, equipo del Obrador Central! ☀️</p>
    <p>Hoy abrimos con <strong>₡${formatNumber(appState.cashRegister.initialFloat)}</strong> en fondo inicial de caja y ya registramos <strong>₡${formatNumber(netCash)}</strong> en liquidez física. El plan de hornos tiene <strong>120 Baguettes</strong> y <strong>80 Croissants</strong> programados para la mañana.</p>
    <ul>
      <li>🔴 <strong>Prioridad en Almacén:</strong> Quedan <strong>${harina.stock} kg de Harina Especial</strong> (mínimo: 50 kg). Recomendamos hacer el pedido temprano para no frenar la producción.</li>
      <li>🟡 <strong>Aprovechamiento:</strong> Hay un lote de Mantequilla que vence en 3 días. Prioricemos la producción de Croissants y Brioche hoy.</li>
    </ul>
  `;
}

// ==========================================
// MOTOR DE VOZ NATURAL EN ESPAÑOL (HIGH-QUALITY & WARM TTS)
// ==========================================
let cachedSpanishVoices = [];
let activeSpeakingButton = null;

function initVoiceEngine() {
  if (!('speechSynthesis' in window)) return;

  function loadVoices() {
    const allVoices = window.speechSynthesis.getVoices();
    cachedSpanishVoices = allVoices.filter(v => 
      v.lang.toLowerCase().startsWith('es') || v.lang.toLowerCase().includes('spanish')
    );
  }

  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function getBestNaturalSpanishVoice() {
  if (!('speechSynthesis' in window)) return null;
  
  let voices = cachedSpanishVoices;
  if (voices.length === 0) {
    voices = window.speechSynthesis.getVoices().filter(v => 
      v.lang.toLowerCase().startsWith('es') || v.lang.toLowerCase().includes('spanish')
    );
    cachedSpanishVoices = voices;
  }

  if (voices.length === 0) return null;

  // Prioritize natural / neural / premium / Google / Microsoft / Apple voices
  const preferredVoice = voices.find(v => {
    const n = v.name.toLowerCase();
    return (
      (n.includes('natural') || n.includes('neural') || n.includes('google') || n.includes('online')) &&
      (v.lang.includes('es-') || v.lang.includes('es_'))
    );
  }) || voices.find(v => {
    const n = v.name.toLowerCase();
    return n.includes('sabina') || n.includes('helena') || n.includes('dalia') || 
           n.includes('monica') || n.includes('paulina') || n.includes('jorge') || 
           n.includes('alonso') || n.includes('laura') || n.includes('diego');
  }) || voices.find(v => {
    return v.lang.includes('es-CR') || v.lang.includes('es-MX') || v.lang.includes('es-US') || v.lang.includes('es-ES');
  }) || voices[0];

  return preferredVoice;
}

function cleanTextForNaturalSpeech(rawText) {
  if (!rawText) return '';

  // 1. Remove HTML tags
  let text = rawText.replace(/<[^>]*>/g, ' ');

  // 2. Convert currency to warm spoken Spanish
  text = text.replace(/₡\s*([0-9.,]+)/g, (match, p1) => {
    const num = parseInt(p1.replace(/[.,]/g, ''), 10);
    return `${num} colones`;
  });

  // 3. Convert abbreviations and units
  text = text.replace(/(\d+)\s*kg\b/gi, '$1 kilos');
  text = text.replace(/(\d+)\s*un\b/gi, '$1 unidades');
  text = text.replace(/(\d+)\s*min\b/gi, '$1 minutos');
  text = text.replace(/\bpos\b/gi, 'punto de venta');
  text = text.replace(/\bpvp\b/gi, 'precio al público');
  text = text.replace(/\biva\b/gi, 'impuesto de ventas');
  text = text.replace(/\bsinpe\b/gi, 'simpe');

  // 4. Remove emojis and excessive symbols
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  text = text.replace(/[•\-_*~#|/\\→✅🔥⚠️⛔⏳🛒🥖🍞🍰☕💵]/g, ' ');

  // 5. Clean up multiple spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

function speakWithNaturalVoice(textToSpeak, onStart, onEnd, buttonEl) {
  if (!('speechSynthesis' in window)) {
    showToast('Tu navegador no soporta síntesis de voz.', 'warning');
    return;
  }

  // If already speaking, stop it
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (activeSpeakingButton) {
      activeSpeakingButton.classList.remove('speaking');
      activeSpeakingButton = null;
    }
    if (onEnd) onEnd();
    return;
  }

  const cleanText = cleanTextForNaturalSpeech(textToSpeak);
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const bestVoice = getBestNaturalSpanishVoice();

  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang = bestVoice.lang;
  } else {
    utterance.lang = 'es-CR';
  }

  // Natural warm & unhurried bakery tone (0.94 rate, 1.04 pitch)
  utterance.rate = 0.94;
  utterance.pitch = 1.04;

  utterance.onstart = () => {
    if (buttonEl) {
      buttonEl.classList.add('speaking');
      activeSpeakingButton = buttonEl;
    }
    if (onStart) onStart(bestVoice ? bestVoice.name : 'Voz en Español');
  };

  utterance.onend = () => {
    if (buttonEl) buttonEl.classList.remove('speaking');
    activeSpeakingButton = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e);
    if (buttonEl) buttonEl.classList.remove('speaking');
    activeSpeakingButton = null;
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

function toggleMorningSpeech() {
  const btn = document.getElementById('btnSpeakMorning');
  const btnText = document.getElementById('speechBtnText');

  if (!('speechSynthesis' in window)) {
    showToast('Tu navegador no soporta síntesis de voz automática.', 'warning');
    return;
  }

  if (window.speechSynthesis.speaking && btn?.classList.contains('speaking')) {
    window.speechSynthesis.cancel();
    btn.classList.remove('speaking');
    if (btnText) btnText.textContent = '🔊 Escuchar Resumen con Voz';
    showToast('Locución detenida', 'info');
    return;
  }

  const harina = appState.inventory.find(i => i.code === 'MP-001') || { stock: 18.5 };
  const morningText = `¡Buenos días equipo de panadería! Hoy abrimos con cincuenta mil colones en fondo de caja. Tenemos 120 baguettes y 80 croissants programados en los hornos. Atención con los ingredientes: quedan solo ${harina.stock} kilos de harina especial en el almacén, debemos pedir el saco de 50 kilos temprano. La mantequilla vence en tres días, así que aprovechemos para hornear croissants hoy. ¡Que tengamos una excelente jornada de pan caliente!`;

  speakWithNaturalVoice(
    morningText,
    (voiceName) => {
      if (btnText) btnText.textContent = '⏹️ Detener Locución';
      showToast(`🔊 PanaderIA hablando (${voiceName.split(' ')[0] || 'Español'})...`, 'info');
    },
    () => {
      if (btnText) btnText.textContent = '🔊 Escuchar Resumen con Voz';
    },
    btn
  );
}

function speakBubbleText(btnEl) {
  const bubble = btnEl.closest('.ai-content');
  if (!bubble) return;

  const textToRead = bubble.innerText || bubble.textContent;
  speakWithNaturalVoice(
    textToRead,
    (voiceName) => {
      btnEl.querySelector('span').textContent = 'Leyendo...';
      showToast(`🔊 PanaderIA leyendo respuesta...`, 'info');
    },
    () => {
      btnEl.querySelector('span').textContent = 'Escuchar Respuesta';
    },
    btnEl
  );
}

// ==========================================
// 4. POS (PUNTO DE VENTA) MODULE & 2-TOUCH COBRO
// ==========================================
let selectedStarProductId = 'INV-006'; // Default Croissant

function renderStarProducts() {
  const container = document.getElementById('starProductsGrid');
  if (!container) return;

  const starItemIds = ['INV-006', 'INV-007', 'INV-008', 'INV-010', 'INV-009'];
  const starItems = appState.inventory.filter(i => starItemIds.includes(i.id));

  if (!starItems.find(i => i.id === selectedStarProductId) && starItems.length > 0) {
    selectedStarProductId = starItems[0].id;
  }

  container.innerHTML = starItems.map(item => {
    const isSelected = item.id === selectedStarProductId;
    const isOut = item.stock <= 0;
    return `
      <div class="star-product-card ${isSelected ? 'selected' : ''} ${isOut ? 'card-out-of-stock' : ''}" onclick="selectStarProduct('${item.id}')">
        <div class="star-product-img-wrap">
          <img src="${item.img || 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=200'}" alt="${item.name}">
        </div>
        <strong class="star-product-name">${item.name}</strong>
        <span class="star-product-price">₡${formatNumber(item.pvp)}</span>
        <span class="star-product-stock-tag ${item.stock <= item.minStock ? 'text-danger' : ''}">
          ${isOut ? '❌ Agotado' : `✅ ${item.stock} disponibles`}
        </span>
      </div>
    `;
  }).join('');

  updateTwoTouchPreview();
  lucide.createIcons();
}

function selectStarProduct(id) {
  selectedStarProductId = id;
  renderStarProducts();
}

function updateTwoTouchPreview() {
  const item = appState.inventory.find(i => i.id === selectedStarProductId);
  if (!item) return;

  const titleEl = document.getElementById('twoTouchSelectedTitle');
  const priceEl = document.getElementById('twoTouchSelectedPrice');
  if (titleEl) titleEl.textContent = item.name;
  if (priceEl) priceEl.textContent = `₡${formatNumber(item.pvp)}`;
}

function processTwoTouchQuickSale(method) {
  const item = appState.inventory.find(i => i.id === selectedStarProductId);
  if (!item) {
    showToast('Selecciona un producto primero.', 'warning');
    return;
  }

  if (item.stock <= 0) {
    showToast(`⚠️ No hay ${item.name} disponible en vitrina. ¡Hornea una tanda primero!`, 'danger');
    return;
  }

  // Deduct 1 unit
  item.stock -= 1;
  const saleAmount = item.pvp || 1600;
  const methodNames = {
    'efectivo': 'Efectivo',
    'transferencia': 'SINPE Móvil',
    'tarjeta': 'Tarjeta'
  };

  if (method === 'efectivo') {
    appState.cashRegister.cashSales += saleAmount;
  } else {
    appState.cashRegister.electronicSales += saleAmount;
  }

  const ticketNum = Math.floor(1000 + Math.random() * 9000);

  // Add movement
  appState.cashRegister.movements.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
    type: 'Venta Express (2 Toques)',
    desc: `1x ${item.name} (${methodNames[method]})`,
    amount: saleAmount,
    user: appState.currentUser.name
  });

  // Add audit log
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Cobro Express (2 Toques)',
    action: `Venta Ticket #${ticketNum}: 1x "${item.name}" por ₡${formatNumber(saleAmount)} (${methodNames[method]})`,
    ip: '192.168.1.10'
  });

  saveState();

  // Populate Printable Receipt Modal
  document.getElementById('recTicketNum').textContent = ticketNum;
  document.getElementById('recDate').textContent = new Date().toLocaleString('es-CR');
  document.getElementById('recCashier').textContent = appState.currentUser.name;
  document.getElementById('recCustomer').textContent = 'Cliente Mostrador';

  const tax = Math.round(saleAmount * 0.13);
  const subtotal = saleAmount - tax;

  document.getElementById('recItemsList').innerHTML = `
    <div class="receipt-item-line">
      <span>1x ${item.name}</span>
      <span>₡${formatNumber(saleAmount)}</span>
    </div>
  `;

  document.getElementById('recSubtotal').textContent = `₡${formatNumber(subtotal)}`;
  document.getElementById('recTax').textContent = `₡${formatNumber(tax)}`;
  document.getElementById('recTotal').textContent = `₡${formatNumber(saleAmount)}`;
  document.getElementById('recMethod').textContent = methodNames[method] || 'Efectivo';

  if (typeof confetti === 'function') {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.65 } });
  }

  openModal('ticketModal');
  showToast(`⚡ ¡Cobro de ₡${formatNumber(saleAmount)} realizado con éxito (${methodNames[method]})!`, 'success');

  renderStarProducts();
  renderPOSCatalog();
  renderCashRegisterView();
  renderDashboardCharts();
}

function renderPOSCatalog() {
  renderStarProducts();
  const container = document.getElementById('posProductGrid');
  const searchVal  = document.getElementById('posSearchInput')?.value.toLowerCase().trim() || '';
  const activeTab  = document.querySelector('.pos-category-tabs .cat-tab.active')?.getAttribute('data-cat') || 'all';

  if (!container) return;

  // Sweep expired items before rendering POS catalog
  autoExpireFinishedGoods();

  const finishedGoods = appState.inventory.filter(item =>
    item.category === 'producto_terminado' && daysUntilExpiry(item.expiry) > 0
  );

  const filtered = finishedGoods.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchVal) || prod.code.toLowerCase().includes(searchVal);
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'panaderia')  return matchesSearch && (prod.name.includes('Croissant') || prod.name.includes('Baguette') || prod.name.includes('Pan'));
    if (activeTab === 'reposteria') return matchesSearch && (prod.name.includes('Tarta') || prod.name.includes('Pastel') || prod.name.includes('Brioche'));
    if (activeTab === 'cafeteria')  return matchesSearch && (prod.name.includes('Café') || prod.name.includes('Espresso') || prod.name.includes('Bebida'));
    return matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="pos-empty-state" style="grid-column:1/-1;">
        <i data-lucide="package-x"></i>
        <p>No hay productos disponibles para "${searchVal || activeTab}"</p>
        <small>Revisa el inventario o lanza una orden de producción.</small>
      </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(prod => {
    const daysLeft  = daysUntilExpiry(prod.expiry);
    const isLowStock = prod.stock > 0 && prod.stock <= prod.minStock;
    const isOut      = prod.stock <= 0;

    let stockBadge = '';
    if (isOut) {
      stockBadge = '<span class="pos-stock-badge badge-out">Sin stock</span>';
    } else if (isLowStock) {
      stockBadge = `<span class="pos-stock-badge badge-low">⚠️ Últimas ${prod.stock} un</span>`;
    } else if (daysLeft <= 7) {
      stockBadge = `<span class="pos-stock-badge badge-expiry">⏳ Vence en ${daysLeft}d</span>`;
    }

    return `
      <div class="pos-product-card ${isOut ? 'card-out-of-stock' : ''}" onclick="${isOut ? '' : `addToCart('${prod.id}')`}">
        <div class="pos-card-img-wrap">
          <img src="${prod.img || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'}" alt="${prod.name}" class="pos-card-img">
          ${stockBadge}
          ${isOut ? '<div class="pos-out-overlay"><i data-lucide="x-circle"></i><span>Sin Stock</span></div>' : ''}
        </div>
        <div class="pos-card-content">
          <h4 class="pos-card-title">${prod.name}</h4>
          <span class="pos-card-stock">Disponible: ${prod.stock} ${prod.unit}</span>
          <div class="pos-card-footer">
            <span class="pos-card-price">₡${formatNumber(prod.pvp || 1500)}</span>
            <button class="btn btn-primary btn-touch ${isOut ? 'btn-disabled' : ''}" ${isOut ? 'disabled' : ''}>
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function addToCart(productId) {
  const prod = appState.inventory.find(i => i.id === productId);
  if (!prod) return;

  if (prod.stock <= 0) {
    showToast('⚠️ Producto agotado en inventario.', 'warning');
    return;
  }

  const existing = currentCart.find(item => item.id === productId);
  if (existing) {
    if (existing.qty >= prod.stock) {
      showToast(`Stock máximo alcanzado (${prod.stock} disponibles).`, 'warning');
      return;
    }
    existing.qty += 1;
  } else {
    currentCart.push({
      id: prod.id,
      code: prod.code,
      name: prod.name,
      price: prod.pvp || 1500,
      qty: 1,
      maxStock: prod.stock
    });
  }

  updateCartUI();
  showToast(`Añadido: ${prod.name}`, 'info');
}

function updateCartQty(productId, delta) {
  const item = currentCart.find(i => i.id === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    currentCart = currentCart.filter(i => i.id !== productId);
  } else if (item.qty > item.maxStock) {
    item.qty = item.maxStock;
    showToast('No puedes exceder el stock disponible', 'warning');
  }

  updateCartUI();
}

function updateCartUI() {
  const container = document.getElementById('cartItemsList');
  const cartCountBadge = document.getElementById('posCartCount');
  const subtotalEl = document.getElementById('cartSubtotal');
  const taxEl = document.getElementById('cartTax');
  const totalEl = document.getElementById('cartTotal');
  const btnPay = document.getElementById('btnProcessPayment');

  const totalItems = currentCart.reduce((sum, item) => sum + item.qty, 0);
  if (cartCountBadge) cartCountBadge.textContent = totalItems;

  if (currentCart.length === 0) {
    if (container) {
      container.innerHTML = `
        <div class="empty-cart-state">
          <i data-lucide="shopping-bag"></i>
          <p>El ticket está vacío</p>
          <small>Haz clic en los productos del menú para añadirlos</small>
        </div>
      `;
    }
    if (subtotalEl) subtotalEl.textContent = '₡0';
    if (taxEl) taxEl.textContent = '₡0';
    if (totalEl) totalEl.textContent = '₡0';
    if (btnPay) btnPay.disabled = true;
    lucide.createIcons();
    return;
  }

  let subtotal = 0;
  container.innerHTML = currentCart.map(item => {
    const itemSub = item.price * item.qty;
    subtotal += itemSub;
    return `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-unit-price">₡${formatNumber(item.price)} x ${item.qty}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
        </div>
        <div class="cart-item-subtotal">₡${formatNumber(itemSub)}</div>
      </div>
    `;
  }).join('');

  const tax = Math.round(subtotal * 0.13); // 13% IVA Costa Rica
  const total = subtotal + tax;

  if (subtotalEl) subtotalEl.textContent = `₡${formatNumber(subtotal)}`;
  if (taxEl) taxEl.textContent = `₡${formatNumber(tax)}`;
  if (totalEl) totalEl.textContent = `₡${formatNumber(total)}`;
  if (btnPay) btnPay.disabled = false;

  lucide.createIcons();
}

function initPOSEvents() {
  // Category tabs
  document.querySelectorAll('.pos-category-tabs .cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pos-category-tabs .cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPOSCatalog();
    });
  });

  // Search input
  document.getElementById('posSearchInput')?.addEventListener('input', () => {
    renderPOSCatalog();
  });

  // Clear cart
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    currentCart = [];
    updateCartUI();
    showToast('Carrito vaciado', 'info');
  });

  // Payment method buttons
  document.querySelectorAll('.payment-method-selector .pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.payment-method-selector .pay-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPaymentMethod = btn.getAttribute('data-method');
    });
  });

  // Process payment
  document.getElementById('btnProcessPayment')?.addEventListener('click', () => {
    processCartSale();
  });
}

function processCartSale() {
  if (currentCart.length === 0) return;

  const ticketNum = Math.floor(1000 + Math.random() * 9000);
  let subtotal = 0;
  currentCart.forEach(item => subtotal += item.price * item.qty);
  const tax = Math.round(subtotal * 0.13);
  const total = subtotal + tax;

  // Deduct inventory
  currentCart.forEach(cartItem => {
    const invItem = appState.inventory.find(i => i.id === cartItem.id);
    if (invItem) {
      invItem.stock -= cartItem.qty;
      if (invItem.stock < 0) invItem.stock = 0;
    }
  });

  // Update Cash register
  if (selectedPaymentMethod === 'efectivo') {
    appState.cashRegister.cashSales += total;
  } else {
    appState.cashRegister.electronicSales += total;
  }

  const methodNames = {
    'efectivo': 'Efectivo',
    'tarjeta': 'Tarjeta / Datáfono',
    'transferencia': 'SINPE Móvil'
  };

  appState.cashRegister.movements.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
    type: 'Venta POS',
    desc: `Factura #${ticketNum} (${methodNames[selectedPaymentMethod]})`,
    amount: total,
    user: appState.currentUser.name
  });

  // Add audit log
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'POS / Ventas',
    action: `Venta Factura #${ticketNum} por ₡${formatNumber(total)} (${methodNames[selectedPaymentMethod]})`,
    ip: '192.168.1.10'
  });

  saveState();

  // Populate Printable Receipt Modal
  document.getElementById('recTicketNum').textContent = ticketNum;
  document.getElementById('recDate').textContent = new Date().toLocaleString('es-CR');
  document.getElementById('recCashier').textContent = appState.currentUser.name;
  
  const customerSelect = document.getElementById('posCustomerSelect');
  const custName = customerSelect ? customerSelect.options[customerSelect.selectedIndex].text : 'Cliente Mostrador';
  document.getElementById('recCustomer').textContent = custName;

  document.getElementById('recItemsList').innerHTML = currentCart.map(item => `
    <div class="receipt-item-line">
      <span>${item.qty}x ${item.name}</span>
      <span>₡${formatNumber(item.price * item.qty)}</span>
    </div>
  `).join('');

  document.getElementById('recSubtotal').textContent = `₡${formatNumber(subtotal)}`;
  document.getElementById('recTax').textContent = `₡${formatNumber(tax)}`;
  document.getElementById('recTotal').textContent = `₡${formatNumber(total)}`;
  document.getElementById('recMethod').textContent = methodNames[selectedPaymentMethod] || 'Efectivo';

  // Trigger celebration confetti
  if (typeof confetti === 'function') {
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
  }

  // Open modal
  openModal('ticketModal');

  // Reset cart
  currentCart = [];
  updateCartUI();
  renderPOSCatalog();
  renderCashRegisterView();
}

function printReceipt() {
  window.print();
}

// ==========================================
// 5. PRODUCCIÓN & RECETAS (ESCANDALLO)
// ==========================================
function renderRecipeMasterList() {
  const container = document.getElementById('recipeMasterList');
  if (!container) return;

  container.innerHTML = appState.recipes.map((rec, idx) => `
    <div class="recipe-item-card ${idx === activeRecipeIndex ? 'active' : ''}" onclick="selectRecipe(${idx})">
      <div class="recipe-item-header">
        <span class="recipe-item-title">${rec.name}</span>
        <span class="badge badge-primary">${rec.id}</span>
      </div>
      <div class="recipe-item-meta">
        <span>Rendimiento: ${rec.baseYield} un</span> • <span>Horno: ${rec.bakeTempC}°C (${rec.bakeTimeMin}m)</span>
      </div>
    </div>
  `).join('');

  renderActiveRecipeDetails();
  renderProductionOrdersTable();
  renderWasteHistory();
}

function selectRecipe(idx) {
  activeRecipeIndex = idx;
  renderRecipeMasterList();
}

function renderActiveRecipeDetails() {
  const rec = appState.recipes[activeRecipeIndex];
  if (!rec) return;

  const multiplier = parseFloat(document.getElementById('batchMultiplier')?.value) || 1.0;
  const scaledYield = Math.round(rec.baseYield * multiplier);

  document.getElementById('currentRecipeTitle').textContent = rec.name;
  document.getElementById('currentRecipeCode').textContent = rec.id;
  document.getElementById('currentRecipeDesc').textContent = rec.desc;
  document.getElementById('baseYield').textContent = `${rec.baseYield} unidades`;
  document.getElementById('scaledYieldText').innerHTML = `(= <strong>${scaledYield} unidades</strong> a producir)`;

  // Escandallo Table
  let rawMaterialsCost = 0;
  const tbody = document.getElementById('recipeIngredientsBody');
  
  if (tbody) {
    tbody.innerHTML = rec.ingredients.map(ing => {
      const scaledQty = (ing.qtyKg * multiplier).toFixed(3);
      const subtotal = Math.round(scaledQty * ing.unitCost);
      rawMaterialsCost += subtotal;
      return `
        <tr>
          <td><strong>${ing.name}</strong></td>
          <td>${scaledQty} kg</td>
          <td>₡${formatNumber(ing.unitCost)} /kg</td>
          <td><strong>₡${formatNumber(subtotal)}</strong></td>
          <td><span class="badge badge-soft">${ing.bakerPercent}</span></td>
        </tr>
      `;
    }).join('');
  }

  const scaledEnergy = Math.round(rec.energyCost * multiplier);
  const scaledLabor = Math.round(rec.laborCost * multiplier);
  const totalBatchCost = rawMaterialsCost + scaledEnergy + scaledLabor;
  const costPerUnit = Math.round(totalBatchCost / scaledYield);
  const pvp = rec.pvp;
  const marginPercent = (((pvp - costPerUnit) / pvp) * 100).toFixed(1);

  document.getElementById('energyCostDisplay').textContent = `₡${formatNumber(scaledEnergy)}`;
  document.getElementById('laborCostDisplay').textContent = `₡${formatNumber(scaledLabor)}`;
  document.getElementById('totalBatchCostDisplay').textContent = `₡${formatNumber(totalBatchCost)}`;

  document.getElementById('costPerUnitDisplay').textContent = `₡${formatNumber(costPerUnit)}`;
  document.getElementById('pvpDisplay').textContent = `₡${formatNumber(pvp)}`;
  document.getElementById('marginDisplay').textContent = `${marginPercent}%`;

  // Bind execute batch button
  const btnBatch = document.getElementById('btnExecuteBatch');
  if (btnBatch) {
    btnBatch.onclick = () => executeBakeBatch(rec, scaledYield, totalBatchCost, multiplier);
  }
}

function executeBakeBatch(rec, scaledYield, totalCost, multiplier) {
  // Deduct raw materials from inventory
  rec.ingredients.forEach(ing => {
    const inv = appState.inventory.find(i => i.name.toLowerCase().includes(ing.name.toLowerCase().substring(0, 8)));
    if (inv) {
      inv.stock -= (ing.qtyKg * multiplier);
      if (inv.stock < 0) inv.stock = 0;
    }
  });

  // Add or increment finished product
  let finishedGood = appState.inventory.find(i => i.name.toLowerCase().includes(rec.name.toLowerCase().substring(0, 10)) && i.category === 'producto_terminado');
  if (finishedGood) {
    finishedGood.stock += scaledYield;
  }

  // Create Production Order record
  const opCode = `OP-2024-${Math.floor(100 + Math.random() * 900)}`;
  appState.productionOrders.unshift({
    id: opCode,
    recipe: rec.name,
    units: scaledYield,
    startTime: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
    baker: appState.currentUser.name,
    status: 'Horneado Exitoso'
  });

  // Audit log
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Producción & Obrador',
    action: `Horneado Lote ${opCode}: ${scaledYield} un de ${rec.name} (Costo Lote: ₡${formatNumber(totalCost)})`,
    ip: '192.168.1.15'
  });

  saveState();
  renderProductionOrdersTable();
  renderInventoryTable();
  showToast(`¡Lote horneado! +${scaledYield} unidades ingresadas a inventario`, 'success');
  if (typeof confetti === 'function') {
    confetti({ particleCount: 50, spread: 50 });
  }
}

function renderProductionOrdersTable() {
  const tbody = document.getElementById('productionOrdersTable');
  if (!tbody) return;

  tbody.innerHTML = appState.productionOrders.map(op => `
    <tr>
      <td><strong>${op.id}</strong></td>
      <td>${op.recipe}</td>
      <td><strong>${op.units} un</strong></td>
      <td>${op.startTime}</td>
      <td>${op.baker}</td>
      <td><span class="status-pill ${op.status === 'Horneado Exitoso' ? 'status-completed' : (op.status === 'En Horno' ? 'status-progress' : 'status-pending')}">${op.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-xs" onclick="showToast('Detalle de OP #${op.id} verificado', 'info')"><i data-lucide="eye"></i></button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function handleRegisterWaste() {
  const type = document.getElementById('wasteType').value;
  const product = document.getElementById('wasteProduct').value;
  const qty = parseInt(document.getElementById('wasteQty').value) || 1;
  const notes = document.getElementById('wasteNotes').value;

  const costEst = qty * 480; // approx unit cost in colones

  appState.wastes.unshift({
    date: `Hoy ${new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}`,
    product: product,
    qty: `${qty} un`,
    type: `${type.toUpperCase()} - ${notes || 'Sin nota'}`,
    cost: costEst
  });

  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Control de Mermas',
    action: `Registro de Merma: ${qty} un de ${product} (₡${formatNumber(costEst)})`,
    ip: '192.168.1.15'
  });

  saveState();
  renderWasteHistory();
  showToast('Merma registrada y costo asentado', 'danger');
  document.getElementById('formRegisterWaste').reset();
}

function renderWasteHistory() {
  const tbody = document.getElementById('wasteHistoryTable');
  if (!tbody) return;

  tbody.innerHTML = appState.wastes.map(w => `
    <tr>
      <td>${w.date}</td>
      <td><strong>${w.product}</strong></td>
      <td>${w.qty}</td>
      <td><span class="badge badge-danger">${w.type}</span></td>
      <td><strong>-₡${formatNumber(w.cost)}</strong></td>
    </tr>
  `).join('');
}

function exportRecipePDF() {
  showToast('Generando Ficha Técnica en PDF...', 'info');
  setTimeout(() => window.print(), 300);
}

// ==========================================
// 6. INVENTARIO & KARDEX
// ==========================================

/** Build combined status badges (can be low-stock AND near-expiry simultaneously). */
function buildStatusBadges(item) {
  const days    = daysUntilExpiry(item.expiry);
  const isLow   = item.stock <= item.minStock;
  const isExpired    = days <= 0;
  const isNearExpiry = days > 0 && days <= 7;
  const badges = [];

  if (isExpired) {
    badges.push('<span class="status-pill status-danger inv-badge-pulse">⛔ VENCIDO</span>');
  } else if (isLow) {
    const pct = Math.min(100, Math.round((item.stock / item.minStock) * 100));
    badges.push(`<span class="status-pill status-danger inv-badge-pulse">⚠️ Stock Bajo (${pct}% del mín)</span>`);
  }

  if (isNearExpiry) {
    badges.push(`<span class="status-pill status-expiry-warn">⏳ Vence en ${days} día${days !== 1 ? 's' : ''}</span>`);
  }

  if (badges.length === 0) {
    badges.push('<span class="status-pill status-completed">✅ Óptimo</span>');
  }

  return badges.join('<br>');
}

function renderInventoryTable() {
  const tbody        = document.getElementById('inventoryTableBody');
  const search       = document.getElementById('invSearchInput')?.value.toLowerCase().trim() || '';
  const typeFilter   = document.getElementById('invTypeFilter')?.value || 'all';
  const statusFilter = document.getElementById('invStatusFilter')?.value || 'all';

  if (!tbody) return;

  // Run auto-expiry sweep each time inventory is viewed
  autoExpireFinishedGoods();

  // FIFO ordering: sort by expiry ascending
  const sorted = [...appState.inventory].sort((a, b) => {
    const da = daysUntilExpiry(a.expiry);
    const db = daysUntilExpiry(b.expiry);
    return da - db;
  });

  const filtered = sorted.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search)
      || item.code.toLowerCase().includes(search)
      || (item.lot && item.lot.toLowerCase().includes(search));
    const matchType   = typeFilter === 'all' || item.category === typeFilter;

    // Resolve live status for filtering
    const days  = daysUntilExpiry(item.expiry);
    const isLow = item.stock <= item.minStock;
    const liveStatus = (days <= 0 || isLow)
      ? 'critico'
      : (days <= 7 ? 'por_vencer' : 'optimo');
    const matchStatus = statusFilter === 'all' || liveStatus === statusFilter;

    return matchSearch && matchType && matchStatus;
  });

  tbody.innerHTML = filtered.map(item => {
    const totalVal     = Math.round(item.stock * item.unitCost);
    const days         = daysUntilExpiry(item.expiry);
    const isLow        = item.stock <= item.minStock;
    const isExpired    = days <= 0;
    const isNearExpiry = days > 0 && days <= 7;
    const isCritical   = isExpired || isLow;

    // Build expiry cell content
    let expiryCell = item.expiry ? new Date(item.expiry).toLocaleDateString('es-CR') : 'Sin fecha';
    if (isExpired) {
      expiryCell = `<span class="status-pill status-danger inv-badge-pulse">⛔ VENCIDO</span>`;
    } else if (isNearExpiry) {
      expiryCell = `<span class="status-pill status-expiry-warn">⏳ Vence en ${days} día${days !== 1 ? 's' : ''}</span>`;
    }

    // Stock cell with traffic-light mini bar
    const stockFill = item.minStock > 0 ? Math.min(100, Math.round((item.stock / item.minStock) * 100)) : 100;
    const fillClass = isExpired ? 'fill-danger' : isLow ? 'fill-danger' : isNearExpiry ? 'fill-warn' : 'fill-ok';
    const stockCell = `
      <div class="stock-cell-wrapper">
        <strong class="${isCritical ? 'text-danger' : isNearExpiry ? 'text-warning' : 'text-success'}">📦 ${item.stock} ${item.unit}</strong>
        <div class="stock-mini-bar">
          <div class="stock-mini-fill ${fillClass}" style="width:${stockFill}%"></div>
        </div>
      </div>`;

    // Category label human-readable
    const catLabel = {
      materia_prima: '🌾 Materia Prima',
      producto_terminado: '🥐 Pan / Repostería',
      empaque: '📦 Empaque',
    }[item.category] || item.category;

    return `
      <tr class="${isCritical ? 'inv-row-critical' : (isNearExpiry ? 'inv-row-warn' : '')}">
        <td><code>${item.code}</code></td>
        <td>
          <strong>${item.name}</strong>
          <div class="text-xs text-muted">Lote: <strong>${item.lot || 'N/A'}</strong></div>
        </td>
        <td><span class="badge badge-soft">${catLabel}</span></td>
        <td>${stockCell}</td>
        <td><span class="text-secondary">${item.minStock} ${item.unit}</span></td>
        <td>${expiryCell}</td>
        <td>₡${formatNumber(item.unitCost)}</td>
        <td><strong>₡${formatNumber(totalVal)}</strong></td>
        <td>${buildStatusBadges(item)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-secondary btn-xs" onclick="openStockAdjustModal('${item.id}')" title="Ajustar cantidad">
            <i data-lucide="edit-3"></i> Ajustar
          </button>
          <button class="btn btn-danger btn-xs" onclick="markAsWasteFromInventory('${item.id}')" title="Registrar como pérdida">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Update sidebar badge
  const { lowStock, nearExpiry } = getInventoryAlerts();
  const alertCount = new Set([...lowStock.map(a => a.item.id), ...nearExpiry.map(a => a.item.id)]).size;
  const badgeEl = document.getElementById('stockAlertBadge');
  if (badgeEl) badgeEl.textContent = alertCount;

  // Render summary stats bar & inline alert banner
  updateInventorySummaryBar();
  renderInventoryAlertBanner();

  lucide.createIcons();
}

/** Update the Quick Stock Summary Bar inside the Inventory View */
function updateInventorySummaryBar() {
  const totalItemsEl = document.getElementById('invTotalItemsCount');
  const totalValEl = document.getElementById('invTotalValueDisplay');
  const alertsEl = document.getElementById('invTotalAlertsDisplay');

  let totalValue = 0;
  appState.inventory.forEach(item => {
    totalValue += (item.stock * item.unitCost);
  });

  const { lowStock, nearExpiry, expired } = getInventoryAlerts();
  const totalAlerts = lowStock.length + nearExpiry.length + expired.length;

  if (totalItemsEl) totalItemsEl.textContent = `${appState.inventory.length} productos`;
  if (totalValEl) totalValEl.textContent = `₡${formatNumber(totalValue)}`;
  if (alertsEl) {
    alertsEl.textContent = `${totalAlerts} alerta${totalAlerts !== 1 ? 's' : ''}`;
    alertsEl.className = totalAlerts > 0 ? 'stat-value text-danger' : 'stat-value text-success';
  }
}

/** Renders a sticky contextual alert banner above the inventory table. */
function renderInventoryAlertBanner() {
  let banner = document.getElementById('invAlertBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'invAlertBanner';
    const invCard = document.querySelector('#view-inventario .card:last-child');
    if (invCard) invCard.parentNode.insertBefore(banner, invCard);
  }

  const { lowStock, nearExpiry, expired } = getInventoryAlerts();
  const totalAlerts = lowStock.length + nearExpiry.length + expired.length;

  if (totalAlerts === 0) {
    banner.innerHTML = `
      <div class="semaforo-strip verde">
        <div class="semaforo-icon">🟢</div>
        <div class="semaforo-label">
          <strong>Todo el stock está en buen estado</strong>
          <span>Sin alertas de vencimiento ni stock bajo</span>
        </div>
      </div>
    `;
    return;
  }

  let strips = '';

  if (expired.length > 0) {
    const names = expired.slice(0,3).map(a => a.item.name.split(' ').slice(0,3).join(' ')).join(', ');
    strips += `
      <div class="semaforo-strip rojo">
        <div class="semaforo-icon">🔴</div>
        <div class="semaforo-label">
          <strong>⛔ ${expired.length} producto(s) VENCIDO(S) — Retirar del mostrador inmediatamente</strong>
          <span>${names}</span>
        </div>
        <button class="btn btn-sm" style="background:#991b1b;color:#fff;flex-shrink:0;" onclick="navigateTo('inventario')">
          Ver ahora
        </button>
      </div>`;
  }

  if (lowStock.length > 0) {
    const names = lowStock.slice(0,3).map(a => `${a.item.name.split(' ')[0]} (${a.item.stock} ${a.item.unit} restante)`).join(', ');
    strips += `
      <div class="semaforo-strip rojo">
        <div class="semaforo-icon">🟥</div>
        <div class="semaforo-label">
          <strong>⚠️ ${lowStock.length} insumo(s) con poco stock — Hacer pedido hoy</strong>
          <span>${names}</span>
        </div>
        <button class="btn btn-sm btn-primary" style="flex-shrink:0;" onclick="navigateTo('compras')">
          Pedir al proveedor
        </button>
      </div>`;
  }

  if (nearExpiry.length > 0) {
    const names = nearExpiry.slice(0,3).map(a => `${a.item.name.split(' ')[0]} (${a.days}d)`).join(', ');
    strips += `
      <div class="semaforo-strip amarillo">
        <div class="semaforo-icon">🟡</div>
        <div class="semaforo-label">
          <strong>🕒 ${nearExpiry.length} lote(s) próximo(s) a vencer esta semana</strong>
          <span>Usar primero: ${names}</span>
        </div>
      </div>`;
  }

  banner.innerHTML = strips;
  lucide.createIcons();
}

/** Quick action: mark all units of an item as waste directly from the table. */
function markAsWasteFromInventory(itemId) {
  const item = appState.inventory.find(i => i.id === itemId);
  if (!item || item.stock <= 0) {
    showToast('No hay unidades que registrar como merma.', 'warning');
    return;
  }
  const costLost = Math.round(item.stock * item.unitCost);
  appState.wastes.unshift({
    date: new Date().toLocaleDateString('es-CR'),
    product: item.name,
    qty: `${item.stock} ${item.unit}`,
    type: 'Pérdida / Vencimiento Registrado',
    cost: costLost
  });
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Inventario y Stock',
    action: `Registro de Pérdida: ${item.stock} ${item.unit} de "${item.name}" → Costo ₡${formatNumber(costLost)}`,
    ip: 'Caja Central #01'
  });
  item.stock = 0;
  item.status = 'critico';
  saveState();
  renderInventoryTable();
  showToast(`"${item.name}" registrado como merma (−₡${formatNumber(costLost)}).`, 'danger');
}

// Quick Stock Entry Mode ('existing' | 'new')
let quickEntryCurrentMode = 'existing';

function openQuickStockEntryModal() {
  const select = document.getElementById('quickEntryItemSelect');
  if (select) {
    select.innerHTML = appState.inventory.map(item => `
      <option value="${item.id}">${item.name} (${item.code}) - Stock: ${item.stock} ${item.unit}</option>
    `).join('');
  }
  switchQuickEntryMode('existing');
  onQuickEntryItemSelected();
  openModal('quickStockEntryModal');
  lucide.createIcons();
}

function switchQuickEntryMode(mode) {
  quickEntryCurrentMode = mode;
  const tabExisting = document.getElementById('tabModeExisting');
  const tabNew = document.getElementById('tabModeNew');
  const secExisting = document.getElementById('quickEntryExistingSection');
  const secNew = document.getElementById('quickEntryNewSection');

  if (mode === 'existing') {
    tabExisting?.classList.add('active');
    tabNew?.classList.remove('active');
    if (secExisting) secExisting.style.display = 'block';
    if (secNew) secNew.style.display = 'none';
    onQuickEntryItemSelected();
  } else {
    tabExisting?.classList.remove('active');
    tabNew?.classList.add('active');
    if (secExisting) secExisting.style.display = 'none';
    if (secNew) secNew.style.display = 'block';
    document.getElementById('quickEntryNewName')?.focus();
  }
  calculateQuickEntryTotal();
}

function onQuickEntryItemSelected() {
  const select = document.getElementById('quickEntryItemSelect');
  if (!select) return;
  const item = appState.inventory.find(i => i.id === select.value);
  if (item) {
    const unitSelect = document.getElementById('quickEntryUnit');
    const costInput = document.getElementById('quickEntryCost');
    const infoEl = document.getElementById('quickEntryItemInfo');
    if (unitSelect) unitSelect.value = item.unit || 'kg';
    if (costInput) costInput.value = item.unitCost || 850;
    if (infoEl) infoEl.textContent = `Stock actual: ${item.stock} ${item.unit} | Costo base: ₡${formatNumber(item.unitCost)} | Lote: ${item.lot || 'N/A'}`;
    calculateQuickEntryTotal();
  }
}

function calculateQuickEntryTotal() {
  const qty = parseFloat(document.getElementById('quickEntryQty')?.value) || 0;
  const cost = parseFloat(document.getElementById('quickEntryCost')?.value) || 0;
  const total = Math.round(qty * cost);
  const display = document.getElementById('quickEntryTotalDisplay');
  if (display) display.textContent = `₡${formatNumber(total)}`;
}

function setExpiryPreset(days) {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const isoStr = `${yyyy}-${mm}-${dd}`;
  const input = document.getElementById('quickEntryExpiry');
  if (input) input.value = isoStr;
}

function clearExpiryPreset() {
  const input = document.getElementById('quickEntryExpiry');
  if (input) input.value = '';
}

function handleSaveQuickStockEntry() {
  const qty = parseFloat(document.getElementById('quickEntryQty')?.value) || 0;
  const unit = document.getElementById('quickEntryUnit')?.value || 'kg';
  const unitCost = parseFloat(document.getElementById('quickEntryCost')?.value) || 0;
  const expiry = document.getElementById('quickEntryExpiry')?.value || '';

  if (qty <= 0) {
    showToast('Por favor ingrese una cantidad mayor a cero.', 'warning');
    return;
  }

  let itemName = '';
  let itemCode = '';

  if (quickEntryCurrentMode === 'existing') {
    const itemId = document.getElementById('quickEntryItemSelect')?.value;
    const item = appState.inventory.find(i => i.id === itemId);
    if (!item) return;

    itemName = item.name;
    itemCode = item.code;
    item.stock += qty;
    if (unitCost > 0) item.unitCost = unitCost;
    if (expiry) item.expiry = expiry;
    item.unit = unit;

  } else {
    const newName = document.getElementById('quickEntryNewName')?.value?.trim();
    if (!newName) {
      showToast('Por favor escribe el nombre del nuevo producto o insumo.', 'warning');
      return;
    }
    const category = document.getElementById('quickEntryNewCategory')?.value || 'materia_prima';
    const prefix = category === 'materia_prima' ? 'MP' : (category === 'producto_terminado' ? 'PT' : 'EMP');
    const randomId = Math.floor(100 + Math.random() * 900);
    const newId = `INV-${randomId}`;
    itemCode = `${prefix}-${Math.floor(10 + Math.random() * 90)}`;
    itemName = newName;

    appState.inventory.push({
      id: newId,
      code: itemCode,
      name: newName,
      category: category,
      stock: qty,
      minStock: Math.round(qty * 0.3) || 5,
      unit: unit,
      unitCost: unitCost,
      pvp: Math.round(unitCost * 2.4),
      lot: `L-${Math.floor(1000 + Math.random() * 9000)}`,
      expiry: expiry || '2027-12-31',
      status: 'optimo',
      img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'
    });
  }

  const totalCost = Math.round(qty * unitCost);

  // Add audit log
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Inventario / Entrada',
    action: `ENTRADA RÁPIDA: +${qty} ${unit} de "${itemName}" (Total: ₡${formatNumber(totalCost)})`,
    ip: '192.168.1.10'
  });

  saveState();
  closeModal('quickStockEntryModal');
  renderInventoryTable();
  renderAISnapshotBar();

  showToast(`✅ ¡Ingreso registrado! +${qty} ${unit} de ${itemName}`, 'success');
  if (typeof confetti === 'function') {
    confetti({ particleCount: 50, spread: 60 });
  }
}

function initInventoryEvents() {
  document.getElementById('invSearchInput')?.addEventListener('input', renderInventoryTable);
  document.getElementById('invTypeFilter')?.addEventListener('change', renderInventoryTable);
  document.getElementById('invStatusFilter')?.addEventListener('change', renderInventoryTable);
  document.getElementById('btnStockMovementModal')?.addEventListener('click', () => openStockAdjustModal());
  document.getElementById('btnQuickStockEntry')?.addEventListener('click', () => openQuickStockEntryModal());
}

function openStockAdjustModal(itemId = null) {
  const select = document.getElementById('adjItemSelect');
  if (select) {
    select.innerHTML = appState.inventory.map(item => `
      <option value="${item.id}" ${item.id === itemId ? 'selected' : ''}>${item.code} - ${item.name} (Stock Actual: ${item.stock} ${item.unit})</option>
    `).join('');
  }
  openModal('stockMovementModal');
}

function handleStockAdjustment() {
  const itemId = document.getElementById('adjItemSelect').value;
  const type = document.getElementById('adjType').value;
  const qty = parseFloat(document.getElementById('adjQuantity').value) || 0;
  const reason = document.getElementById('adjReason').value;

  const item = appState.inventory.find(i => i.id === itemId);
  if (!item) return;

  if (type === 'entrada') {
    item.stock += qty;
  } else if (type === 'salida') {
    item.stock -= qty;
    if (item.stock < 0) item.stock = 0;
  } else if (type === 'ajuste') {
    item.stock = qty;
  }

  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Inventario y Stock',
    action: `Ajuste de Stock (${type}): ${item.name} a ${item.stock} ${item.unit}. Motivo: ${reason}`,
    ip: 'Caja Central #01'
  });

  saveState();
  closeModal('stockMovementModal');
  renderInventoryTable();
  showToast(`Stock de ${item.name} actualizado a ${item.stock} ${item.unit}`, 'success');
}

// ==========================================
// 7. CONTROL DE CAJA & ARQUEO
// ==========================================
function renderCashRegisterView() {
  const { initialFloat, cashSales, electronicSales, expenses, movements } = appState.cashRegister;
  const netCashInDrawer = initialFloat + cashSales - expenses;

  document.getElementById('cashInitial').textContent = `₡${formatNumber(initialFloat)}`;
  document.getElementById('cashInflow').textContent = `₡${formatNumber(cashSales)}`;
  document.getElementById('cashElectronic').textContent = `₡${formatNumber(electronicSales)}`;
  document.getElementById('cashOutflow').textContent = `-₡${formatNumber(expenses)}`;

  document.getElementById('systemCashDisplay').textContent = `₡${formatNumber(netCashInDrawer)}`;

  // Movements Table
  const tbody = document.getElementById('cashMovementsTable');
  if (tbody) {
    tbody.innerHTML = movements.map(m => `
      <tr>
        <td><strong>${m.time}</strong></td>
        <td><span class="badge ${m.type.includes('Egreso') ? 'badge-danger' : 'badge-success'}">${m.type}</span></td>
        <td>${m.desc}</td>
        <td><strong class="${m.amount < 0 ? 'text-danger' : 'text-success'}">${m.amount < 0 ? '-' : ''}₡${formatNumber(Math.abs(m.amount))}</strong></td>
        <td>${m.user}</td>
      </tr>
    `).join('');
  }

  // Quick cash badge in topbar
  const quickBadge = document.getElementById('quickCashBadge');
  if (quickBadge) {
    quickBadge.innerHTML = `<span class="dot-live"></span><span>Caja 01: <strong>₡${formatNumber(netCashInDrawer)}</strong></span>`;
  }

  calculateCashTally();
}

function calculateCashTally() {
  let totalPhysical = 0;
  const inputs = document.querySelectorAll('.cash-counter-grid .denom-input');

  inputs.forEach(input => {
    const val = parseInt(input.getAttribute('data-value')) || 0;
    const qty = parseInt(input.value) || 0;
    const sub = val * qty;
    totalPhysical += sub;
    const labelEl = document.getElementById(`denom-${val}`);
    if (labelEl) labelEl.textContent = `₡${formatNumber(sub)}`;
  });

  const { initialFloat, cashSales, expenses } = appState.cashRegister;
  const theoreticalCash = initialFloat + cashSales - expenses;
  const diff = totalPhysical - theoreticalCash;

  document.getElementById('countedCashDisplay').textContent = `₡${formatNumber(totalPhysical)}`;
  
  const diffEl = document.getElementById('cashDifferenceDisplay');
  if (diffEl) {
    if (diff === 0) {
      diffEl.className = 'badge badge-success';
      diffEl.textContent = '₡0 (Cuadre Exacto ✅)';
    } else if (diff > 0) {
      diffEl.className = 'badge badge-warning';
      diffEl.textContent = `+₡${formatNumber(diff)} (Sobrante en caja)`;
    } else {
      diffEl.className = 'badge badge-danger';
      diffEl.textContent = `-₡${formatNumber(Math.abs(diff))} (Faltante ⚠️)`;
    }
  }
}

// ==========================================
// 8. LOGÍSTICA & RUTAS (REPARTIDOR / ENVÍOS)
// ==========================================
function renderLogisticsView() {
  const container = document.getElementById('deliveryOrdersList');
  const badgeEl = document.getElementById('driverDeliveriesCount');
  if (!container) return;

  const pendingCount = appState.deliveries.filter(d => !d.status.includes('Entregado')).length;
  if (badgeEl) badgeEl.textContent = `${pendingCount} Pendiente${pendingCount !== 1 ? 's' : ''}`;

  container.innerHTML = appState.deliveries.map(d => {
    const isDone = d.status.includes('Entregado');
    return `
      <div class="delivery-item-flex">
        <div>
          <strong class="text-base">${d.client}</strong>
          <div class="text-xs text-muted"><i data-lucide="map-pin"></i> ${d.address}</div>
          <div class="text-xs text-primary font-semibold mt-1">📦 ${d.items}</div>
          <div class="text-xs text-muted mt-1">Repartidor: <strong>${d.driver}</strong> • Hora: ${d.eta}</div>
        </div>
        <div class="text-right">
          ${isDone ? `
            <button class="btn-deliver-check delivered" disabled>
              <i data-lucide="check-circle-2"></i> Entregado ✅
            </button>
          ` : `
            <button class="btn-deliver-check" onclick="markDeliveryDelivered('${d.id}')">
              <i data-lucide="check"></i> Marcar Entregado
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function markDeliveryDelivered(deliveryId) {
  const del = appState.deliveries.find(d => d.id === deliveryId);
  if (!del) return;

  del.status = 'Entregado ✅';
  
  // Audit log
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Logística / Entregas',
    action: `Pedido ${del.id} entregado con éxito en "${del.client}" (${del.items})`,
    ip: '192.168.1.18 (Móvil Repartidor)'
  });

  saveState();
  if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
  showToast(`🚚 ¡Pedido en ${del.client} marcado como entregado con éxito!`, 'success');
  renderLogisticsView();
}

// ==========================================
// 9. CRM & CLIENTES
// ==========================================
function renderCRMView() {
  const tbody = document.getElementById('crmCustomerBody');
  if (!tbody) return;

  tbody.innerHTML = appState.customers.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone}</td>
      <td><span class="badge badge-primary">${c.tier}</span></td>
      <td><strong class="text-primary">${c.points} pts</strong></td>
      <td>₡${formatNumber(c.totalSpent)}</td>
      <td>${c.lastVisit}</td>
      <td>
        <button class="btn btn-secondary btn-xs" onclick="showToast('Puntos canjeados para ${c.name}', 'success')"><i data-lucide="gift"></i> Canjear</button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function sendPromoWhatsApp() {
  showToast('📲 Enviando campaña WhatsApp: "Jueves 2x1 en Medialunas" a clientes de la panadería...', 'success');
}

// ==========================================
// 10. ASISTENTE INTELIGENTE (PANADERIA IA)
// ==========================================

function renderAISnapshotBar() {
  const bar = document.getElementById('aiSnapshotBar');
  if (!bar) return;

  const totalSales = appState.cashRegister.cashSales + appState.cashRegister.electronicSales;
  const cashInDrawer = appState.cashRegister.initialFloat + appState.cashRegister.cashSales - appState.cashRegister.expenses;
  const { lowStock, nearExpiry } = getInventoryAlerts();
  const alertCount = lowStock.length + nearExpiry.length;

  bar.innerHTML = `
    <div class="ai-snap-card">
      <div class="ai-snap-icon bg-amber"><i data-lucide="dollar-sign"></i></div>
      <div class="ai-snap-info">
        <div class="ai-snap-label">Ventas Registradas Hoy</div>
        <div class="ai-snap-val">₡${formatNumber(totalSales)}</div>
      </div>
    </div>
    <div class="ai-snap-card">
      <div class="ai-snap-icon bg-green"><i data-lucide="vault"></i></div>
      <div class="ai-snap-info">
        <div class="ai-snap-label">Efectivo en Gaveta</div>
        <div class="ai-snap-val">₡${formatNumber(cashInDrawer)}</div>
      </div>
    </div>
    <div class="ai-snap-card">
      <div class="ai-snap-icon bg-blue"><i data-lucide="alert-triangle"></i></div>
      <div class="ai-snap-info">
        <div class="ai-snap-label">Alertas de Insumos</div>
        <div class="ai-snap-val">${alertCount} artículos</div>
      </div>
    </div>
    <div class="ai-snap-card">
      <div class="ai-snap-icon bg-purple"><i data-lucide="trending-up"></i></div>
      <div class="ai-snap-info">
        <div class="ai-snap-label">Margen Bruto Global</div>
        <div class="ai-snap-val">68.4%</div>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function askAIPrompt(text) {
  const input = document.getElementById('aiUserInput');
  if (input) {
    input.value = text;
    handleSendAIMessage();
  }
}

function askFloatingAIPrompt(text) {
  const input = document.getElementById('floatingAIInput');
  if (input) {
    input.value = text;
    handleFloatingAIMessage();
  }
}

// ==========================================
// SPEECH-TO-TEXT (DICTADO POR VOZ INTEGRAL)
// ==========================================
let activeSpeechRecognition = null;
let isListeningVoice = false;

function toggleVoiceRecognition(target = 'main') {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mainMicBtn = document.getElementById('aiVoiceBtn');
  const floatingMicBtn = document.getElementById('floatingVoiceBtn');
  const statusBadge = document.getElementById('voiceStatusBadge');
  const statusText = document.getElementById('voiceStatusText');
  const targetInput = target === 'main' ? document.getElementById('aiUserInput') : document.getElementById('floatingAIInput');

  if (isListeningVoice) {
    if (activeSpeechRecognition) {
      activeSpeechRecognition.stop();
    }
    isListeningVoice = false;
    mainMicBtn?.classList.remove('listening');
    floatingMicBtn?.classList.remove('listening');
    if (statusBadge) statusBadge.style.display = 'none';
    showToast('Micrófono detenido', 'info');
    return;
  }

  if (!SpeechRecognition) {
    // Modo simulación inteligente si el navegador no expone Web Speech API
    showToast('🎙️ Escuchando... (Modo voz de panadería)', 'info');
    mainMicBtn?.classList.add('listening');
    floatingMicBtn?.classList.add('listening');
    if (statusBadge) {
      statusBadge.style.display = 'inline-flex';
      if (statusText) statusText.textContent = '🎙️ Escuchando voz del panadero...';
    }
    isListeningVoice = true;

    const sampleQueries = [
      "Se vendieron 5 croissants",
      "Sacamos 40 baguettes del horno",
      "Compramos 50 kilos de harina",
      "Se quemaron 3 croissants",
      "¿Cuánto dinero hay en caja hoy?",
      "¿Qué ingredientes se vencen pronto?"
    ];
    const picked = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];

    setTimeout(() => {
      if (targetInput) targetInput.value = picked;
      mainMicBtn?.classList.remove('listening');
      floatingMicBtn?.classList.remove('listening');
      if (statusBadge) statusBadge.style.display = 'none';
      isListeningVoice = false;
      showToast(`🎤 Dictado recibido: "${picked}"`, 'success');
      if (target === 'main') handleSendAIMessage();
      else handleFloatingAIMessage();
    }, 1800);
    return;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CR'; // Español de Costa Rica
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListeningVoice = true;
      mainMicBtn?.classList.add('listening');
      floatingMicBtn?.classList.add('listening');
      if (statusBadge) {
        statusBadge.style.display = 'inline-flex';
        if (statusText) statusText.textContent = '🎙️ Escuchando... ¡habla ahora!';
      }
      showToast('🎙️ Escuchando... habla cerca del micrófono', 'info');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          if (targetInput) targetInput.value = event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
          if (targetInput) targetInput.value = interimTranscript;
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      mainMicBtn?.classList.remove('listening');
      floatingMicBtn?.classList.remove('listening');
      if (statusBadge) statusBadge.style.display = 'none';
      isListeningVoice = false;
      showToast('No se pudo capturar el audio. Intente de nuevo o escriba su consulta.', 'warning');
    };

    recognition.onend = () => {
      mainMicBtn?.classList.remove('listening');
      floatingMicBtn?.classList.remove('listening');
      if (statusBadge) statusBadge.style.display = 'none';
      isListeningVoice = false;
      if (targetInput && targetInput.value.trim().length > 0) {
        showToast('🎤 Consulta dictada con éxito', 'success');
        if (target === 'main') handleSendAIMessage();
        else handleFloatingAIMessage();
      }
    };

    activeSpeechRecognition = recognition;
    recognition.start();
  } catch (err) {
    console.error('Speech recognition exception:', err);
    mainMicBtn?.classList.remove('listening');
    floatingMicBtn?.classList.remove('listening');
    if (statusBadge) statusBadge.style.display = 'none';
    isListeningVoice = false;
  }
}

// ==========================================
// DIRECT ACTION HANDLERS (EJECUCIÓN DIRECTA)
// ==========================================

function executeAIBakeBatch(recipeName, qty) {
  executeQuickBakeInternal(recipeName, qty);
  appendAIInlineConfirmation(`✅ **¡Horneada registrada en el sistema!** Se hornearon **${qty} unidades** de *${recipeName}*. Se descontaron las harinas del almacén y el pan caliente ya está listo para la venta en el Punto de Venta.`);
}

function executeAIQuickBuy(itemCodeOrId, qty, unitCost) {
  const item = appState.inventory.find(i => i.id === itemCodeOrId || i.code === itemCodeOrId);
  if (!item) {
    showToast('Insumo no encontrado en inventario.', 'warning');
    return;
  }

  item.stock += qty;
  const totalCost = Math.round(qty * (unitCost || item.unitCost));

  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Almacén / Compras',
    action: `Compra directa por voz: +${qty} ${item.unit} de "${item.name}" (₡${formatNumber(totalCost)})`,
    ip: '192.168.1.10'
  });

  saveState();
  renderInventoryTable();
  renderAISnapshotBar();
  renderDashboardSemaforo();

  if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
  showToast(`🛒 ¡Compra registrada! +${qty} ${item.unit} de ${item.name} al almacén`, 'success');

  appendAIInlineConfirmation(`✅ **¡Compra sumada al almacén!** Se agregaron **+${qty} ${item.unit}** de *${item.name}* (Inversión: ₡${formatNumber(totalCost)}). El disponible actual es de **${item.stock} ${item.unit}**.`);
}


function appendAIInlineConfirmation(messageHtml) {
  const containers = [document.getElementById('aiMessagesContainer'), document.getElementById('floatingAIMessages')];
  containers.forEach(container => {
    if (container) {
      container.innerHTML += `
        <div class="ai-bubble-msg ai">
          <div class="ai-avatar"><i data-lucide="check-circle"></i></div>
          <div class="ai-content" style="border-left: 4px solid var(--success);">
            <p>${messageHtml}</p>
          </div>
        </div>
      `;
      container.scrollTop = container.scrollHeight;
    }
  });
  lucide.createIcons();
}

// ==========================================
// PROCESADOR DE LENGUAJE NATURAL Y VOZ
// ==========================================
function generateAIResponse(query) {
  const q = query.toLowerCase();
  const harina = appState.inventory.find(i => i.code === 'MP-001') || { stock: 18.5, unit: 'kg', unitCost: 850 };
  const mantequilla = appState.inventory.find(i => i.code === 'MP-002') || { stock: 12, unit: 'kg', unitCost: 6500 };
  const totalSales = appState.cashRegister.cashSales + appState.cashRegister.electronicSales;
  const netCash = appState.cashRegister.initialFloat + appState.cashRegister.cashSales - appState.cashRegister.expenses;

  // 1. INTENCIÓN: VENTA REGISTRADA POR VOZ / LENGUAJE COTIDIANO
  // Ej: "Se vendieron 10 croissants", "vendí 3 baguettes", "cobré 2 cafés"
  if (q.includes('vendi') || q.includes('vendió') || q.includes('vendieron') || q.includes('cobre') || q.includes('cobré') || q.includes('venta de')) {
    const numMatch = q.match(/\d+/);
    const qty = numMatch ? parseInt(numMatch[0], 10) : 1;
    
    let matchedItem = null;
    if (q.includes('croissant')) matchedItem = appState.inventory.find(i => i.name.toLowerCase().includes('croissant'));
    else if (q.includes('baguette')) matchedItem = appState.inventory.find(i => i.name.toLowerCase().includes('baguette'));
    else if (q.includes('sourdough') || q.includes('masa madre') || q.includes('campesino')) matchedItem = appState.inventory.find(i => i.name.toLowerCase().includes('sourdough') || i.name.toLowerCase().includes('campesino'));
    else if (q.includes('tarta') || q.includes('pastel') || q.includes('selva negra')) matchedItem = appState.inventory.find(i => i.name.toLowerCase().includes('tarta') || i.name.toLowerCase().includes('selva negra'));
    else if (q.includes('café') || q.includes('cafe') || q.includes('espresso')) matchedItem = appState.inventory.find(i => i.name.toLowerCase().includes('café') || i.name.toLowerCase().includes('espresso'));
    else {
      matchedItem = appState.inventory.find(i => i.category === 'producto_terminado' && q.includes(i.name.toLowerCase().split(' ')[0]));
    }

    if (matchedItem) {
      const saleQty = Math.min(qty, matchedItem.stock > 0 ? matchedItem.stock : qty);
      matchedItem.stock = Math.max(0, matchedItem.stock - saleQty);
      const saleTotal = saleQty * (matchedItem.pvp || 1600);
      appState.cashRegister.cashSales += saleTotal;
      appState.cashRegister.movements.unshift({
        time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
        type: 'Venta Directa',
        desc: `Venta por voz: ${saleQty} un de ${matchedItem.name}`,
        amount: saleTotal,
        user: appState.currentUser.name
      });
      appState.auditLogs.unshift({
        time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        user: appState.currentUser.name,
        role: appState.currentUser.roleTitle,
        module: 'Cobro / Ventas por Voz',
        action: `Venta por voz: ${saleQty} un de "${matchedItem.name}" → Total: ₡${formatNumber(saleTotal)}`,
        ip: '192.168.1.10'
      });
      saveState();
      renderInventoryTable();
      renderCashRegisterView();
      if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
      showToast(`🛒 ¡Venta de ${saleQty} ${matchedItem.name} registrada! (+₡${formatNumber(saleTotal)})`, 'success');
      
      return `
        <p>✅ <strong>¡Venta registrada con éxito en el sistema!</strong></p>
        <ul>
          <li>🥐 <strong>Producto:</strong> ${matchedItem.name}</li>
          <li>🔢 <strong>Cantidad descontada de vitrina:</strong> ${saleQty} ${matchedItem.unit} (Quedan ${matchedItem.stock} un en vitrina).</li>
          <li>💰 <strong>Total sumado a la caja de hoy:</strong> <strong>₡${formatNumber(saleTotal)}</strong> (PVP unitario ₡${formatNumber(matchedItem.pvp)}).</li>
        </ul>
        <div class="ai-inline-actions">
          <button class="btn-ai-action" onclick="navigateTo('caja')"><i data-lucide="wallet"></i> 💵 Ver Dinero en Caja</button>
          <button class="btn-ai-action btn-ai-outline" onclick="navigateTo('pos')"><i data-lucide="shopping-cart"></i> 🛒 Ir a Cobrar</button>
        </div>
      `;
    }
  }

  // 2. INTENCIÓN: HORNEADA REGISTRADA POR VOZ
  // Ej: "Sacamos 40 baguettes del horno", "horneamos 50 croissants", "horneé 20 panes"
  if (q.includes('sacamos') || q.includes('horneamos') || q.includes('horneé') || q.includes('horneo') || (q.includes('hornear') && q.match(/\d+/)) || q.includes('salieron del horno')) {
    const numMatch = q.match(/\d+/);
    const qty = numMatch ? parseInt(numMatch[0], 10) : 40;
    
    let prodName = 'Croissant Francés de Mantequilla';
    if (q.includes('baguette')) prodName = 'Baguette Rústico Masa Madre';
    else if (q.includes('sourdough') || q.includes('masa madre') || q.includes('campesino')) prodName = 'Pan Campesino Sourdough (500g)';
    else if (q.includes('tarta') || q.includes('selva negra')) prodName = 'Tarta Selva Negra Gourmet (Porción)';
    
    executeQuickBakeInternal(prodName, qty);
    return `
      <p>🥖 <strong>¡Horneada registrada y lista para vender!</strong></p>
      <ul>
        <li>🔥 <strong>Producto:</strong> ${prodName}</li>
        <li>🔢 <strong>Piezas ingresadas a vitrina:</strong> <strong>+${qty} unidades</strong>.</li>
        <li>🌾 <strong>Almacén:</strong> Se descontaron automáticamente las harinas e ingredientes necesarios según la receta.</li>
      </ul>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="navigateTo('pos')"><i data-lucide="shopping-cart"></i> 🛒 Cobrar en Mostrador</button>
        <button class="btn-ai-action btn-ai-outline" onclick="navigateTo('produccion')"><i data-lucide="flame"></i> 🍞 Ver Horno y Recetas</button>
      </div>
    `;
  }

  // 3. INTENCIÓN: COMPRA DE SACOS / INGREDIENTES POR VOZ
  // Ej: "Compramos 50 kilos de harina", "llegaron 2 sacos de azúcar", "compré 15 kg de mantequilla"
  if (q.includes('compramos') || q.includes('compré') || q.includes('llegaron') || q.includes('llegó') || q.includes('recibimos') || q.includes('entran')) {
    const numMatch = q.match(/\d+/);
    const qty = numMatch ? parseInt(numMatch[0], 10) : 50;
    
    let itemCode = 'MP-001';
    let unitCost = 850;
    
    if (q.includes('mantequilla')) {
      itemCode = 'MP-002';
      unitCost = 6500;
    } else if (q.includes('azúcar') || q.includes('azucar')) {
      itemCode = 'MP-005';
      unitCost = 950;
    } else if (q.includes('levadura')) {
      itemCode = 'MP-003';
      unitCost = 2200;
    } else if (q.includes('chocolate')) {
      itemCode = 'MP-004';
      unitCost = 11500;
    }
    
    const item = appState.inventory.find(i => i.code === itemCode);
    if (item) {
      item.stock += qty;
      const totalCost = Math.round(qty * (item.unitCost || unitCost));
      appState.auditLogs.unshift({
        time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        user: appState.currentUser.name,
        role: appState.currentUser.roleTitle,
        module: 'Almacén / Ingreso por Voz',
        action: `Entrada por voz: +${qty} ${item.unit} de "${item.name}" (Inversión: ₡${formatNumber(totalCost)})`,
        ip: '192.168.1.10'
      });
      saveState();
      renderInventoryTable();
      renderDashboardSemaforo();
      if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
      showToast(`🌾 ¡+${qty} ${item.unit} de ${item.name} sumados al almacén!`, 'success');
      
      return `
        <p>🌾 <strong>¡Ingreso registrado en el almacén de ingredientes!</strong></p>
        <ul>
          <li>📦 <strong>Insumo:</strong> ${item.name}</li>
          <li>⚖️ <strong>Cantidad sumada:</strong> +${qty} ${item.unit} (Nuevo total disponible: <strong>${item.stock} ${item.unit}</strong>).</li>
          <li>💵 <strong>Valor de la compra:</strong> ₡${formatNumber(totalCost)}.</li>
        </ul>
        <div class="ai-inline-actions">
          <button class="btn-ai-action" onclick="navigateTo('inventario')"><i data-lucide="boxes"></i> 🌾 Ver Almacén</button>
          <button class="btn-ai-action btn-ai-outline" onclick="navigateTo('produccion')"><i data-lucide="flame"></i> 🥐 Ir al Horno</button>
        </div>
      `;
    }
  }

  // 4. INTENCIÓN: ANOTAR PAN SOBRANTE / QUEMADO
  if (q.includes('quem') || q.includes('sobró') || q.includes('sobro') || q.includes('dañ') || q.includes('rompi') || q.includes('perdid') || q.includes('pérdid')) {
    const numMatch = q.match(/\d+/);
    const qty = numMatch ? parseInt(numMatch[0], 10) : 3;
    let prod = 'Croissant Francés de Mantequilla';
    if (q.includes('baguette')) prod = 'Baguette Rústico Masa Madre';
    
    return `
      <p>💡 <strong>Anotación de Pan Dañado o Sobrante:</strong></p>
      <p>Se detectó la intención de registrar <strong>${qty} unidades</strong> de <em>${prod}</em>.</p>
      <p>Si es pan de ayer, puedes convertirlo en <strong>Bostocks de Almendra</strong> y venderlos a ₡2,200 c/u sin desperdiciar nada.</p>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="executeAITransformWaste()">
          <i data-lucide="sparkles"></i> 🥐 Transformar a Bostocks de Almendra
        </button>
        <button class="btn-ai-action btn-ai-outline" onclick="openQuickWasteModal()">
          <i data-lucide="trash-2"></i> 🗑️ Anotar como Desperdicio
        </button>
      </div>
    `;
  }

  // 5. CONSULTAS GENERALES
  if (q.includes('fin de semana') || q.includes('predicci') || q.includes('demanda') || q.includes('hornear')) {
    return `
      <p>🥐 <strong>Recomendación de Horneado para el Fin de Semana:</strong></p>
      <ul>
        <li><strong>Sábado:</strong> Se proyecta alta demanda en la mañana (07:00 AM - 10:30 AM).</li>
        <li><strong>Plan Sugerido:</strong>
          <ul>
            <li><strong>Croissants de Mantequilla:</strong> 120 piezas en 2 tandas.</li>
            <li><strong>Baguettes Rústicos:</strong> 90 piezas.</li>
            <li><strong>Pan de Masa Madre:</strong> 50 hogazas.</li>
          </ul>
        </li>
      </ul>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="executeAIBakeBatch('Croissant Francés de Mantequilla', 120)">
          <i data-lucide="flame"></i> ➕ Hornear 120 Croissants
        </button>
        <button class="btn-ai-action" onclick="executeAIBakeBatch('Baguette Tradicional Francés', 90)">
          <i data-lucide="flame"></i> ➕ Hornear 90 Baguettes
        </button>
      </div>
    `;
  } else if (q.includes('compra') || q.includes('materia') || q.includes('insumo') || q.includes('proveedor') || q.includes('falta') || q.includes('harina')) {
    return `
      <p>🛒 <strong>Ingredientes que necesitas comprar:</strong></p>
      <ul>
        <li>🔴 <strong>Harina de Trigo Especial:</strong> Quedan <strong>${harina.stock} ${harina.unit}</strong> (Mínimo: 50 kg). Sugerido comprar <strong>50 kg</strong> (₡42,500).</li>
        <li>🟠 <strong>Mantequilla Pura 84%:</strong> Quedan <strong>${mantequilla.stock} ${mantequilla.unit}</strong> (Lote por vencer). Sugerido pedir <strong>15 kg</strong> (₡97,500).</li>
      </ul>
      <p>💰 <strong>Inversión estimada:</strong> <strong>₡140,000</strong>. Hay dinero disponible en caja (₡${formatNumber(netCash)}).</p>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="executeAIQuickBuy('MP-001', 50, 850)">
          <i data-lucide="shopping-cart"></i> 🛒 Comprar 50kg Harina (₡42,500)
        </button>
        <button class="btn-ai-action" onclick="executeAIQuickBuy('MP-002', 15, 6500)">
          <i data-lucide="shopping-cart"></i> 🛒 Comprar 15kg Mantequilla (₡97,500)
        </button>
      </div>
    `;
  } else if (q.includes('caja') || q.includes('dinero') || q.includes('efectivo') || q.includes('cuanto hay')) {
    return `
      <p>💵 <strong>Estado del Dinero en Caja Hoy:</strong></p>
      <ul>
        <li>💵 <strong>Efectivo en mostrador:</strong> ₡${formatNumber(appState.cashRegister.cashSales)}</li>
        <li>📱 <strong>Ventas por SINPE Móvil & Tarjeta:</strong> ₡${formatNumber(appState.cashRegister.electronicSales)}</li>
        <li>💰 <strong>Total en físico que debe haber en gaveta:</strong> <strong>₡${formatNumber(netCash)}</strong></li>
        <li>✅ <strong>Estado:</strong> Cuadre perfecto sin faltantes.</li>
      </ul>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="navigateTo('caja')">
          <i data-lucide="calculator"></i> 💵 Contar Billetes de Caja
        </button>
      </div>
    `;
  } else if (q.includes('vence') || q.includes('vencimiento') || q.includes('caduc')) {
    return `
      <p>⏳ <strong>Ingredientes próximos a vencer:</strong></p>
      <ul>
        <li>🟠 <strong>Mantequilla Pura 84%:</strong> Lote L-8812 vence en <strong>3 días</strong>. Recomendado usar hoy en horneado de Croissants.</li>
        <li>🟡 <strong>Levadura Fresca:</strong> Lote L-9023 vence en <strong>6 días</strong>.</li>
      </ul>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="executeAIBakeBatch('Croissant Francés de Mantequilla', 60)">
          <i data-lucide="flame"></i> 🥐 Hornear 60 Croissants (Consumir Mantequilla)
        </button>
      </div>
    `;
  } else if (q.includes('vendido') || q.includes('mas vendido') || q.includes('más vendido') || q.includes('popular')) {
    return `
      <p>🥖 <strong>El Pan Más Vendido Hoy:</strong></p>
      <ul>
        <li>🏆 <strong>#1 Croissant Francés de Mantequilla:</strong> 112 piezas vendidas (₡179,200 recaudados). Ganancia: 70%.</li>
        <li>🥈 <strong>#2 Baguette Rústico:</strong> 78 piezas (₡93,600).</li>
        <li>🥉 <strong>#3 Tarta Selva Negra:</strong> 34 porciones (₡85,000).</li>
      </ul>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="navigateTo('pos')">
          <i data-lucide="shopping-cart"></i> 🛒 Ir a Cobrar
        </button>
      </div>
    `;
  } else {
    return `
      <p>He analizado tu consulta:</p>
      <p>Actualmente el obrador tiene ventas acumuladas por <strong>₡${formatNumber(totalSales)}</strong> y <strong>₡${formatNumber(netCash)}</strong> en efectivo físico disponible.</p>
      <p>Puedes hablarme o pedirme cosas directas como: <em>"Se vendieron 5 croissants"</em> o <em>"Sacamos 40 baguettes del horno"</em>.</p>
      <div class="ai-inline-actions">
        <button class="btn-ai-action" onclick="askAIPrompt('¿Qué harina o mantequilla debo comprar?')">
          <i data-lucide="shopping-bag"></i> 🛒 Sugerencia de Compras
        </button>
        <button class="btn-ai-action btn-ai-outline" onclick="navigateTo('caja')">
          <i data-lucide="wallet"></i> 💵 Dinero en Caja
        </button>
      </div>
    `;
  }
}

function handleSendAIMessage() {
  const input = document.getElementById('aiUserInput');
  const query = input?.value.trim();
  if (!query) return;

  const chatContainer = document.getElementById('aiMessagesContainer');
  
  chatContainer.innerHTML += `
    <div class="ai-bubble-msg user">
      <div class="ai-content">
        <p>${query}</p>
      </div>
    </div>
  `;

  input.value = '';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  setTimeout(() => {
    const aiResponse = generateAIResponse(query);

    chatContainer.innerHTML += `
      <div class="ai-bubble-msg ai">
        <div class="ai-avatar"><i data-lucide="sparkles"></i></div>
        <div class="ai-content">
          ${aiResponse}
          <div class="ai-speech-bar">
            <span class="voice-meta-tag"><i data-lucide="sparkles"></i> PanaderIA Voz</span>
            <button class="btn-speak-bubble" onclick="speakBubbleText(this)">
              <i data-lucide="volume-2"></i> <span>Escuchar Respuesta</span>
            </button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, 400);
}

function executeAIQuickBuy(itemCode, qty, unitCost) {
  const item = appState.inventory.find(i => i.code === itemCode);
  if (item) {
    item.stock += qty;
    const totalCost = Math.round(qty * (item.unitCost || unitCost));
    appState.auditLogs.unshift({
      time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user: appState.currentUser.name,
      role: appState.currentUser.roleTitle,
      module: 'Compras / Almacén',
      action: `Compra asistida: +${qty} ${item.unit} de "${item.name}" (Costo: ₡${formatNumber(totalCost)})`,
      ip: '192.168.1.10'
    });
    saveState();
    renderInventoryTable();
    renderDashboardCharts();
    if (typeof confetti === 'function') confetti({ particleCount: 40, spread: 50 });
    showToast(`🌾 ¡Compra registrada! Se sumaron ${qty} ${item.unit} de ${item.name} al almacén.`, 'success');
  }
}

function executeAITransformWaste() {
  const croissant = appState.inventory.find(i => i.name.toLowerCase().includes('croissant'));
  if (croissant && croissant.stock > 0) {
    croissant.stock = Math.max(0, croissant.stock - 3);
  }
  
  let bostock = appState.inventory.find(i => i.name.toLowerCase().includes('bostock'));
  if (!bostock) {
    appState.inventory.push({
      id: `INV-${Date.now().toString().slice(-4)}`,
      code: 'PT-012',
      name: 'Bostocks de Almendra & Almíbar (Reutilizado)',
      category: 'producto_terminado',
      stock: 3,
      unit: 'un',
      minStock: 2,
      expiry: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      unitCost: 350,
      pvp: 2200,
      img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400'
    });
  } else {
    bostock.stock += 3;
  }

  saveState();
  renderInventoryTable();
  renderPOSCatalog();
  if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
  showToast('🥐 ¡3 Croissants transformados con éxito a Bostocks de Almendra (+₡6,600 en vitrina)!', 'success');
}

function clearAIChat() {
  const chatContainer = document.getElementById('aiMessagesContainer');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="ai-bubble-msg ai">
        <div class="ai-avatar"><i data-lucide="sparkles"></i></div>
        <div class="ai-content">
          <p>¡Hola! Soy <strong>PanaderIA</strong>, tu asistente de panadería. Puedes decirme cosas cotidianas como:</p>
          <p>🗣️ <em>"Se vendieron 10 croissants"</em>, <em>"Sacamos 50 baguettes del horno"</em>, <em>"Compramos 50 kilos de harina"</em> o <em>"¿Cuánto hay en caja?"</em></p>
        </div>
      </div>
    `;
    lucide.createIcons();
  }
}

// Floating Quick Chat Widget
function toggleFloatingAIChat() {
  const panel = document.getElementById('floatingAIPanel');
  if (panel) {
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) {
      document.getElementById('floatingAIInput')?.focus();
    }
  }
}

function handleFloatingAIMessage() {
  const input = document.getElementById('floatingAIInput');
  const query = input?.value.trim();
  if (!query) return;

  const container = document.getElementById('floatingAIMessages');
  container.innerHTML += `
    <div class="ai-bubble-msg user">
      <div class="ai-content" style="padding: 8px 12px; font-size: 0.82rem;">
        <p>${query}</p>
      </div>
    </div>
  `;

  input.value = '';
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    const aiResponse = generateAIResponse(query);
    container.innerHTML += `
      <div class="ai-bubble-msg ai">
        <div class="ai-avatar" style="width: 28px; height: 28px;"><i data-lucide="sparkles" style="width: 14px; height: 14px;"></i></div>
        <div class="ai-content" style="padding: 10px 14px; font-size: 0.82rem;">
          ${aiResponse}
        </div>
      </div>
    `;
    lucide.createIcons();
    container.scrollTop = container.scrollHeight;
  }, 350);
}

// ==========================================
// MODAL TÁCTIL 1: SACAR DEL HORNO (REGISTRO RÁPIDO)
// ==========================================
let currentQuickBakeProduct = 'Croissant Francés de Mantequilla';
let currentQuickBakeQty = 40;

function openQuickBakeModal() {
  openModal('quickBakeModal');
}

function updateQuickBakeSelected(name, defaultQty) {
  currentQuickBakeProduct = name;
  setQuickBakeQty(defaultQty);
}

function setQuickBakeQty(qty) {
  currentQuickBakeQty = qty;
  const input = document.getElementById('quickBakeQtyInput');
  if (input) input.value = qty;
  document.querySelectorAll('#quickBakeModal .btn-quick-qty').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.textContent, 10) === qty);
  });
}

function handleExecuteQuickBake() {
  const input = document.getElementById('quickBakeQtyInput');
  const qty = input ? parseInt(input.value, 10) : currentQuickBakeQty;
  executeQuickBakeInternal(currentQuickBakeProduct, qty);
  closeModal('quickBakeModal');
}

function executeQuickBakeInternal(productName, qty) {
  // Increase finished product in inventory
  const finishedItem = appState.inventory.find(i => 
    i.category === 'producto_terminado' && 
    (i.name.toLowerCase().includes(productName.toLowerCase().split(' ')[0]) || productName.toLowerCase().includes(i.name.toLowerCase().split(' ')[0]))
  );
  if (finishedItem) {
    finishedItem.stock += qty;
  }

  // Deduct raw materials roughly
  const harina = appState.inventory.find(i => i.code === 'MP-001');
  if (harina && harina.stock > 0) {
    harina.stock = Math.max(0, parseFloat((harina.stock - (qty * 0.05)).toFixed(1)));
  }
  const mantequilla = appState.inventory.find(i => i.code === 'MP-002');
  if (mantequilla && productName.toLowerCase().includes('croissant') && mantequilla.stock > 0) {
    mantequilla.stock = Math.max(0, parseFloat((mantequilla.stock - (qty * 0.025)).toFixed(1)));
  }

  // Add audit log
  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Horno / Obrador',
    action: `Horneada completada: +${qty} piezas de "${productName}" ingresadas a vitrina`,
    ip: '192.168.1.15'
  });

  saveState();
  renderInventoryTable();
  renderDashboardSemaforo();

  if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
  showToast(`🍞 ¡${qty} ${productName} recién horneados e ingresados a vitrina!`, 'success');
}

// ==========================================
// MODAL TÁCTIL 2: ANOTAR PAN SOBRANTE / DAÑADO
// ==========================================
let currentQuickWasteQty = 3;

function openQuickWasteModal() {
  openModal('quickWasteModal');
}

function setQuickWasteModalQty(qty) {
  currentQuickWasteQty = qty;
  const input = document.getElementById('quickWasteModalQtyInput');
  if (input) input.value = qty;
  document.querySelectorAll('#quickWasteModal .btn-quick-qty').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.textContent, 10) === qty);
  });
}

function handleExecuteQuickWasteModal() {
  const prodSelect = document.getElementById('quickWasteProdSelect');
  const reasonInput = document.querySelector('input[name="quickWasteReason"]:checked');
  const qtyInput = document.getElementById('quickWasteModalQtyInput');

  const prodName = prodSelect ? prodSelect.value : 'Croissant Francés de Mantequilla';
  const reason = reasonInput ? reasonInput.value : 'Se quemó en el horno';
  const qty = qtyInput ? parseInt(qtyInput.value, 10) : 3;

  const item = appState.inventory.find(i => i.name.toLowerCase().includes(prodName.toLowerCase().split(' ')[0]));
  const unitCost = item ? item.unitCost : 480;
  if (item && item.stock > 0) {
    item.stock = Math.max(0, item.stock - qty);
  }

  const costLost = qty * unitCost;

  appState.wastes.unshift({
    date: 'Hoy ' + new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
    product: prodName,
    qty: `${qty} un`,
    type: reason,
    cost: costLost
  });

  appState.auditLogs.unshift({
    time: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: appState.currentUser.name,
    role: appState.currentUser.roleTitle,
    module: 'Obrador / Pérdidas',
    action: `Anotado pan sobrante/dañado: ${qty} un de "${prodName}" (${reason}) → ₡${formatNumber(costLost)}`,
    ip: '192.168.1.15'
  });

  saveState();
  renderInventoryTable();
  renderWastesTable();
  renderDashboardSemaforo();
  closeModal('quickWasteModal');
  showToast(`🗑️ Se registraron ${qty} ${prodName} en desperdicio (₡${formatNumber(costLost)})`, 'warning');
}

// ==========================================
// SELECTOR DE MODO DASHBOARD (SIMPLE vs AVANZADO)
// ==========================================
let currentDashboardMode = 'simple';

function setDashboardMode(mode) {
  currentDashboardMode = mode;
  const simpleView = document.getElementById('dashSimpleView');
  const advancedView = document.getElementById('dashAdvancedView');
  const btnSimple = document.getElementById('btnDashModeSimple');
  const btnAdvanced = document.getElementById('btnDashModeAdvanced');

  if (mode === 'simple') {
    if (simpleView) simpleView.style.display = 'block';
    if (advancedView) advancedView.style.display = 'none';
    btnSimple?.classList.add('active');
    btnAdvanced?.classList.remove('active');
  } else {
    if (simpleView) simpleView.style.display = 'none';
    if (advancedView) advancedView.style.display = 'block';
    btnSimple?.classList.remove('active');
    btnAdvanced?.classList.add('active');
    renderDashboardCharts();
  }
}

// ==========================================
// SEMÁFORO DEL OBRADOR (ALERTAS EN LENGUAJE HUMANO)
// ==========================================
function renderDashboardSemaforo() {
  const container = document.getElementById('dashSemaforoBanner');
  if (!container) return;

  const { lowStock, nearExpiry, expired } = getInventoryAlerts();
  const harina = appState.inventory.find(i => i.code === 'MP-001') || { stock: 18.5, minStock: 50, unit: 'kg' };
  const mantequilla = appState.inventory.find(i => i.code === 'MP-002') || { stock: 12, minStock: 15, unit: 'kg' };

  let cardsHtml = '';

  // 1. Alerta Roja (Urgente) si la harina está baja
  if (harina.stock <= harina.minStock) {
    cardsHtml += `
      <div class="semaforo-card semaforo-red">
        <div class="semaforo-content">
          <span class="semaforo-badge-dot"></span>
          <div class="semaforo-text">
            <strong>🔴 ¡Urgente!: Queda poca Harina de Trigo Especial</strong>
            <p>Solo quedan <strong>${harina.stock} kg</strong> en saco (mínimo recomendado: 50 kg). Se necesita compra para no frenar horneadas.</p>
          </div>
        </div>
        <button class="semaforo-action-btn" onclick="executeAIQuickBuy('MP-001', 50, 850)">
          <i data-lucide="shopping-cart"></i> Comprar 50kg Harina (₡42,500)
        </button>
      </div>
    `;
  }

  // 2. Alerta Amarilla (Atención) si la mantequilla vence pronto
  if (nearExpiry.length > 0 || mantequilla.stock <= mantequilla.minStock) {
    cardsHtml += `
      <div class="semaforo-card semaforo-yellow">
        <div class="semaforo-content">
          <span class="semaforo-badge-dot"></span>
          <div class="semaforo-text">
            <strong>🟡 Atención en Almacén: Mantequilla pura próxima a vencer</strong>
            <p>El lote de mantequilla (12 kg) vence en 3 días. Recomendamos hornear Croissants o Brioche para aprovecharla al 100%.</p>
          </div>
        </div>
        <button class="semaforo-action-btn" onclick="openQuickBakeModal()">
          <i data-lucide="flame"></i> Sacar Croissants del Horno
        </button>
      </div>
    `;
  }

  // 3. Alerta Verde (Todo bien)
  cardsHtml += `
    <div class="semaforo-card semaforo-green">
      <div class="semaforo-content">
        <span class="semaforo-badge-dot"></span>
        <div class="semaforo-text">
          <strong>🟢 Hornos y Caja en Excelente Marcha</strong>
          <p>485 piezas horneadas hoy · Efectivo físico en gaveta cuadrado exactamente · 0 faltantes.</p>
        </div>
      </div>
      <button class="semaforo-action-btn" onclick="navigateTo('pos')">
        <i data-lucide="shopping-cart"></i> Cobrar a Cliente
      </button>
    </div>
  `;

  container.innerHTML = cardsHtml;
  lucide.createIcons();
}

// ==========================================
// 11. AUDITORÍA & ROLES
// ==========================================
function renderAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  tbody.innerHTML = appState.auditLogs.map(log => {
    let deviceLabel = log.ip || 'Caja Central #01';
    if (deviceLabel === '192.168.1.10') deviceLabel = 'Caja Mostrador #01';
    if (deviceLabel === '192.168.1.12') deviceLabel = 'Caja Mostrador #02';
    if (deviceLabel === '192.168.1.15') deviceLabel = 'Tablet del Obrador';
    if (deviceLabel === '0.0.0.0') deviceLabel = 'Sistema Automático';

    let cleanModule = (log.module || 'Sistema')
      .replace('Kardex', 'Almacén')
      .replace('POS / Ventas', 'Punto de Venta')
      .replace('Inventario / Entrada', 'Ingreso de Almacén')
      .replace('Inventario / Kardex', 'Ingredientes & Almacén');

    let cleanAction = (log.action || '')
      .replace('Kardex', 'Almacén')
      .replace('MERMA AUTOMÁTICA', 'Pan vencido anotado')
      .replace('ENTRADA RÁPIDA:', 'Ingreso al almacén:');

    return `
      <tr>
        <td><code>${log.time}</code></td>
        <td><strong>${log.user}</strong></td>
        <td><span class="badge badge-soft">${log.role}</span></td>
        <td>${cleanModule}</td>
        <td>${cleanAction}</td>
        <td><code>${deviceLabel}</code></td>
      </tr>
    `;
  }).join('');
}

function switchUserRole(roleKey, name, title) {
  appState.currentUser = { name, roleTitle: title, roleKey };
  document.getElementById('currentUserName').textContent = name;
  document.getElementById('currentUserRole').textContent = title;
  document.getElementById('posCashierName').textContent = name;
  
  saveState();
  closeModal('roleSwitchModal');
  showToast(`Modo cambiado a: ${title}`, 'success');
}

function exportAuditLogs() {
  showToast('Exportando historial en formato CSV...', 'info');
}

// ==========================================
// 12. CHARTS (CHART.JS)
// ==========================================
let salesChartInstance = null;
let costChartInstance = null;

function renderDashboardCharts() {
  // Render Morning Proactive Summary & Semáforo alerts
  renderMorningSummary();
  renderDashboardSemaforo();

  // 1. Sales vs AI Demand Chart
  const salesCanvas = document.getElementById('salesHourlyChart');
  if (salesCanvas) {
    if (salesChartInstance) salesChartInstance.destroy();

    const ctx = salesCanvas.getContext('2d');
    salesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM'],
        datasets: [
          {
            label: 'Ventas Reales (₡ CRC)',
            data: [45000, 115000, 92000, 148500, null, null, null, null],
            borderColor: '#c27803',
            backgroundColor: 'rgba(194, 120, 3, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#c27803'
          },
          {
            label: 'Pronóstico de Demanda PanaderIA',
            data: [42000, 110000, 95000, 140000, 88000, 135000, 110000, 52000],
            borderColor: '#8b5cf6',
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#8b5cf6'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Plus Jakarta Sans', weight: '600' } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ₡${formatNumber(ctx.raw || 0)}` } }
        },
        scales: {
          y: {
            ticks: {
              callback: (val) => `₡${val / 1000}k`,
              font: { family: 'Plus Jakarta Sans' }
            },
            grid: { color: '#f1f5f9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 2. Cost Structure Pie Chart
  const costCanvas = document.getElementById('costStructureChart');
  if (costCanvas) {
    if (costChartInstance) costChartInstance.destroy();

    const ctx2 = costCanvas.getContext('2d');
    costChartInstance = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Harinas & Granos', 'Mantequilla & Lácteos', 'Chocolates & Rellenos', 'Mano de Obra', 'Energía & Hornos'],
        datasets: [{
          data: [28, 32, 18, 14, 8],
          backgroundColor: ['#d97706', '#f59e0b', '#78350f', '#3b82f6', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        },
        cutout: '65%'
      }
    });
  }

  // Top Products List
  const topList = document.getElementById('topProductsList');
  if (topList) {
    topList.innerHTML = `
      <div class="top-prod-item">
        <div class="top-prod-info">
          <span class="top-prod-rank">1</span>
          <div>
            <strong>Croissant Francés</strong>
            <div class="text-xs text-muted">142 unidades vendidas hoy</div>
          </div>
        </div>
        <span class="badge badge-success">Ganancia 70%</span>
      </div>
      <div class="top-prod-item">
        <div class="top-prod-info">
          <span class="top-prod-rank">2</span>
          <div>
            <strong>Baguette Rústico</strong>
            <div class="text-xs text-muted">98 unidades vendidas</div>
          </div>
        </div>
        <span class="badge badge-success">Ganancia 71%</span>
      </div>
      <div class="top-prod-item">
        <div class="top-prod-info">
          <span class="top-prod-rank">3</span>
          <div>
            <strong>Pan Sourdough (500g)</strong>
            <div class="text-xs text-muted">35 hogazas vendidas</div>
          </div>
        </div>
        <span class="badge badge-success">Ganancia 73%</span>
      </div>
    `;
  }
}


/** Renders a compact inventory alert panel inside the Dashboard view. */
function renderDashboardInventoryAlerts() {
  let panel = document.getElementById('dashInvAlertPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'dashInvAlertPanel';
    panel.style.marginTop = '24px';
    const chartsGrid = document.querySelector('#view-dashboard .charts-grid');
    if (chartsGrid) chartsGrid.parentNode.insertBefore(panel, chartsGrid);
  }

  const { lowStock, nearExpiry, expired } = getInventoryAlerts();
  const total = lowStock.length + nearExpiry.length + expired.length;

  if (total === 0) {
    panel.innerHTML = `
      <div class="dash-inv-alert-bar dash-inv-ok">
        <i data-lucide="shield-check"></i>
        <strong>Inventario Saludable</strong>
        <span>Todos los insumos y productos terminados están dentro de parámetros óptimos.</span>
      </div>`;
    lucide.createIcons();
    return;
  }

  const criticalItems = [
    ...expired.map(a => ({ label: `⛔ ${a.item.name.substring(0,28)}`, type: 'expired', id: a.item.id })),
    ...lowStock.map(a => ({ label: `⚠️ ${a.item.name.substring(0,24)} (${a.item.stock}/${a.item.minStock} ${a.item.unit})`, type: 'low', id: a.item.id })),
    ...nearExpiry.map(a => ({ label: `⏳ ${a.item.name.substring(0,24)} — ${a.days}d para vencer`, type: 'expiry', id: a.item.id }))
  ];

  panel.innerHTML = `
    <div class="dash-inv-alert-bar dash-inv-critical">
      <div class="dash-alert-header">
        <i data-lucide="alert-triangle"></i>
        <strong>${total} Alerta${total !== 1 ? 's' : ''} de Inventario</strong>
        <span class="dash-alert-sub">${expired.length} vencidos · ${lowStock.length} bajo mínimo · ${nearExpiry.length} próximos a vencer</span>
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('inventario')">Ver Almacén →</button>
      </div>
      <div class="dash-alert-chips">
        ${criticalItems.map(a => `<span class="alert-chip chip-${a.type === 'expired' ? 'expired' : (a.type === 'low' ? 'danger' : 'warning')}">${a.label}</span>`).join('')}
      </div>
    </div>
  `;
  lucide.createIcons();
}

// ==========================================
// 13. MODAL & TOAST HELPERS
// ==========================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('show');
    el.style.display = 'flex';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('show');
    el.style.display = 'none';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconName = type === 'success' ? 'check-circle' : (type === 'danger' ? 'alert-octagon' : (type === 'warning' ? 'alert-triangle' : 'info'));
  toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${message}</span>`;
  
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatNumber(num) {
  return Math.round(num || 0).toLocaleString('es-CR');
}

function formatCurrency(num) {
  return `₡${formatNumber(num)}`;
}

// ==========================================
// 14. APPLICATION INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSystemClock();
  initPOSEvents();
  initInventoryEvents();

  // Batch Multiplier Listener
  document.getElementById('batchMultiplier')?.addEventListener('input', () => {
    renderActiveRecipeDetails();
  });

  // Supplier list in Compras
  const suppList = document.getElementById('supplierList');
  if (suppList) {
    suppList.innerHTML = appState.suppliers.map(s => `
      <div class="delivery-item">
        <div>
          <strong>${s.name}</strong>
          <div class="text-xs text-muted">${s.category} • ${s.contact}</div>
        </div>
        <div class="text-right">
          <span class="badge badge-success">${s.rating}</span>
          <div class="text-xs text-muted mt-1">${s.terms}</div>
        </div>
      </div>
    `).join('');
  }

  // Branch selector change
  document.getElementById('branchSelect')?.addEventListener('change', (e) => {
    appState.activeBranch = e.target.value;
    saveState();
    showToast(`Sucursal cambiada a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
  });

  // Initialize Firebase Firestore Cloud Connection
  initFirebaseFirestore();

  // Initialize Voice Engine
  initVoiceEngine();

  // Apply Role Access Rules & Current Profile
  const initialRoleKey = appState.currentUser?.roleKey || 'admin';
  const initialUser = USERS_DB[initialRoleKey] || USERS_DB.admin;
  applyRoleAccessRules(initialUser);

  // Present the Master Pantalla de Inicio / Login Portal on startup
  showLockScreen();

  // Keyboard shortcut: Ctrl+Shift+S → open SuperAdmin login
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      openSuperAdminLogin();
    }
  });

  lucide.createIcons();
});


// ==========================================================================
// SUPERADMIN MODULE — BakeMaster Pro
// Control global de sucursales y usuarios con sincronización Firestore
// Acceso exclusivo: memo96cr@hotmail.com / Juli2024
// ==========================================================================

// ── Credenciales hardcodeadas (nunca exponer en producción sin Firebase Auth) ──
const SUPERADMIN_CREDENTIALS = {
  email:    'memo96cr@hotmail.com',
  password: 'Juli2024'
};

// ── Estado del módulo ──────────────────────────────────────────────────────
let _saIsLoggedIn       = false;
let _saUsersUnsubscribe = null; // Referencia al listener onSnapshot de usuarios

// ── Sucursales iniciales del sistema ──────────────────────────────────────
const SA_BRANCHES_DEFAULT = [
  { id: 'central', nombre: 'Sucursal Central (Obrador)', activo: true },
  { id: 'norte',   nombre: 'Sucursal Norte (Tienda)',    activo: true },
  { id: 'gourmet', nombre: 'Sucursal Gourmet & Café',    activo: true }
];

// Badge colors por rol
const SA_ROL_BADGES = {
  admin:     { label: '👑 Admin',      color: '#b45309', bg: '#fef3c7' },
  cajero:    { label: '🛒 Cajero',     color: '#1d4ed8', bg: '#dbeafe' },
  chef:      { label: '👨‍🍳 Panadero', color: '#047857', bg: '#d1fae5' },
  logistica: { label: '🚚 Repartidor', color: '#6d28d9', bg: '#ede9fe' }
};

// ==========================================================================
// AUTENTICACIÓN SUPERADMIN & PORTAL DE INICIO
// ==========================================================================

/** Cambia de pestaña en el Portal de Inicio (SuperAdmin vs Operador/PIN) */
function switchLoginTab(tabName) {
  const btnSa  = document.getElementById('tabBtnSuperAdmin');
  const btnEmp = document.getElementById('tabBtnEmpleado');
  const contSa = document.getElementById('tabContentSuperAdmin');
  const contEmp = document.getElementById('tabContentEmpleado');

  if (tabName === 'superadmin') {
    btnSa.style.background = 'linear-gradient(135deg,#4f46e5,#7c3aed)';
    btnSa.style.color = '#fff';
    btnSa.style.boxShadow = '0 4px 12px rgba(99,102,241,0.35)';

    btnEmp.style.background = 'transparent';
    btnEmp.style.color = '#94a3b8';
    btnEmp.style.boxShadow = 'none';

    contSa.style.display = 'block';
    contEmp.style.display = 'none';
  } else {
    btnEmp.style.background = 'linear-gradient(135deg,#c27803,#f59e0b)';
    btnEmp.style.color = '#fff';
    btnEmp.style.boxShadow = '0 4px 12px rgba(194,120,3,0.35)';

    btnSa.style.background = 'transparent';
    btnSa.style.color = '#94a3b8';
    btnSa.style.boxShadow = 'none';

    contSa.style.display = 'none';
    contEmp.style.display = 'block';
  }
  lucide.createIcons();
}

/** Alterna la visibilidad de la contraseña entre texto y puntos */
function togglePasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

/** Rellena automáticamente las credenciales oficiales de SuperAdmin para agilidad */
function fillSuperAdminCredentials() {
  const emailEl = document.getElementById('portalSaEmail');
  const passEl  = document.getElementById('portalSaPassword');
  if (emailEl) emailEl.value = SUPERADMIN_CREDENTIALS.email;
  if (passEl)  passEl.value  = SUPERADMIN_CREDENTIALS.password;
  showToast('⚡ Credenciales de SuperAdmin cargadas.', 'info');
}

/** Valida las credenciales ingresadas en la Pantalla de Inicio / Portal */
function submitPortalSuperAdminLogin() {
  const email = document.getElementById('portalSaEmail')?.value.trim().toLowerCase();
  const pass  = document.getElementById('portalSaPassword')?.value;
  const errEl = document.getElementById('portalSaErrorMsg');

  if (!email || !pass) {
    if (errEl) errEl.textContent = '⚠️ Ingresa correo y contraseña.';
    return;
  }

  if (
    email === SUPERADMIN_CREDENTIALS.email.toLowerCase() &&
    pass  === SUPERADMIN_CREDENTIALS.password
  ) {
    _saIsLoggedIn = true;

    // Mostrar sección SuperAdmin en sidebar
    const navItem    = document.getElementById('navSuperAdmin');
    const navSection = document.getElementById('navSectionSuperAdmin');
    if (navItem)    navItem.style.display    = '';
    if (navSection) navSection.style.display = '';

    // Ocultar pantalla de inicio
    hideLockScreen();
    showToast('🛡️ SuperAdmin activo. Bienvenido/a, memo96cr.', 'success');

    // Escuchar colección de usuarios en tiempo real
    attachUsersFirestoreListener();

    // Actualizar usuario actual a SuperAdmin
    appState.currentUser = {
      name: 'memo96cr (SuperAdmin)',
      roleTitle: 'Super Administrador Global',
      roleKey: 'admin',
      isSuperAdmin: true
    };
    document.body.className = 'theme-light mode-obrador role-admin';
    const curUserEl = document.getElementById('currentUserName');
    if (curUserEl) curUserEl.textContent = 'memo96cr (SuperAdmin)';
    const curRoleEl = document.getElementById('currentUserRole');
    if (curRoleEl) curRoleEl.textContent = 'Super Administrador Global';

    // Mostrar sección SuperAdmin en sidebar
    const navItem    = document.getElementById('navSuperAdmin');
    const navSection = document.getElementById('navSectionSuperAdmin');
    if (navItem)    navItem.style.display    = '';
    if (navSection) navSection.style.display = '';

    // Navegar directamente al panel SuperAdmin
    navigateTo('superadmin');
    renderSuperAdminPanel();
    lucide.createIcons();

    // Registrar en auditoría
    appState.auditLogs.unshift({
      time:   new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user:   'memo96cr@hotmail.com',
      role:   'SuperAdmin',
      module: 'SuperAdmin',
      action: 'Inicio de sesión SuperAdmin desde Pantalla de Inicio',
      ip:     '–'
    });
    saveState();

  } else {
    if (errEl) errEl.textContent = '❌ Credenciales incorrectas. Acceso denegado.';
    const card = document.querySelector('#loginPortalOverlay .pin-lock-card');
    if (card) {
      card.style.animation = 'shake 0.35s ease';
      setTimeout(() => { card.style.animation = ''; }, 400);
    }
  }
}

/** Abre el modal de login SuperAdmin (o portal) */
function openSuperAdminLogin() {
  const overlay = document.getElementById('loginPortalOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    switchLoginTab('superadmin');
  } else {
    const modal = document.getElementById('superAdminLoginModal');
    if (modal) modal.style.display = 'flex';
  }
  lucide.createIcons();
}

/** Cierra la sesión SuperAdmin y regresa a la Pantalla de Inicio */
function logoutSuperAdmin() {
  _saIsLoggedIn = false;

  // Ocultar nav item
  const navItem    = document.getElementById('navSuperAdmin');
  const navSection = document.getElementById('navSectionSuperAdmin');
  if (navItem)    navItem.style.display    = 'none';
  if (navSection) navSection.style.display = 'none';

  // Cancelar listener Firestore de usuarios
  if (_saUsersUnsubscribe) {
    _saUsersUnsubscribe();
    _saUsersUnsubscribe = null;
  }

  showToast('🔒 Sesión SuperAdmin cerrada.', 'info');

  appState.auditLogs.unshift({
    time:   new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user:   'memo96cr@hotmail.com',
    role:   'SuperAdmin',
    module: 'SuperAdmin',
    action: 'Cierre de sesión SuperAdmin',
    ip:     '–'
  });
  saveState();

  // Mostrar de nuevo la Pantalla de Inicio
  showLockScreen();
}

// ==========================================================================
// FIRESTORE: LISTENER EN TIEMPO REAL DE USUARIOS
// ==========================================================================

/**
 * Adjunta un onSnapshot a la colección `usuarios` de Firestore.
 * Cada cambio (create/update/delete) actualiza la tabla en tiempo real
 * y regenera el USERS_DB local para que el sistema de PIN funcione.
 */
function attachUsersFirestoreListener() {
  if (!firestoreDB) {
    // Firestore no disponible → mostrar usuarios locales
    renderUsersTableLocal();
    return;
  }

  // Cancelar listener previo si existe
  if (_saUsersUnsubscribe) _saUsersUnsubscribe();

  _saUsersUnsubscribe = firestoreDB.collection('usuarios')
    .orderBy('createdAt', 'desc')
    .onSnapshot({ includeMetadataChanges: false }, (snap) => {
      const users = snap.docs.map(d => ({ _fsId: d.id, ...d.data() }));

      // Actualizar USERS_DB en memoria con usuarios de Firestore
      users.forEach(u => {
        USERS_DB[u.username] = {
          key:       u.username,
          name:      u.nombre,
          roleTitle: getRolTitle(u.rol),
          roleKey:   u.rol,
          pin:       u.pin,
          bodyClass: getRolBodyClass(u.rol),
          homeView:  getRolHomeView(u.rol),
          avatar:    u.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
          sucursal:  u.sucursal,
          email:     u.email || ''
        };
      });

      // Actualizar tabla y KPI
      renderUsersTable(users);
      const kpi = document.getElementById('saKpiTotalUsers');
      if (kpi) kpi.textContent = users.length;

      // Regenerar tarjetas en el lock screen
      renderPinLockUserGrid();

      const subtitle = document.getElementById('saUsersSubtitle');
      if (subtitle) {
        const fromCache = snap.metadata.fromCache;
        subtitle.textContent = fromCache
          ? '📦 Datos desde caché local (sin conexión)'
          : `✅ Sincronizado con Firestore · ${users.length} usuario(s)`;
      }

      console.log(`[SuperAdmin] 👥 usuarios actualizado (${users.length} docs)`);
    }, (err) => {
      console.error('[SuperAdmin] Error en listener usuarios:', err);
      renderUsersTableLocal();
    });
}

/** Fallback: renderiza usuarios del USERS_DB local cuando Firestore no está disponible */
function renderUsersTableLocal() {
  const users = Object.values(USERS_DB).map(u => ({
    username: u.key,
    nombre:   u.name,
    rol:      u.roleKey,
    sucursal: u.sucursal || 'central',
    email:    u.email || '–',
    activo:   true
  }));
  renderUsersTable(users);
  const kpi = document.getElementById('saKpiTotalUsers');
  if (kpi) kpi.textContent = users.length;
}

// ==========================================================================
// RENDERIZADO DEL PANEL SUPERADMIN
// ==========================================================================

function renderSuperAdminPanel() {
  renderSaBranchList();
  if (!firestoreDB) renderUsersTableLocal();
  lucide.createIcons();
}

/** Renderiza la lista de sucursales */
function renderSaBranchList() {
  const container = document.getElementById('saBranchList');
  if (!container) return;

  const branches = SA_BRANCHES_DEFAULT;
  container.innerHTML = branches.map(b => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-weight:700;font-size:0.88rem;color:var(--text-main);">${b.nombre}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-family:monospace;">ID: ${b.id}</div>
      </div>
      <span style="
        padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:700;
        background:${b.activo ? '#d1fae5' : '#fee2e2'};
        color:${b.activo ? '#047857' : '#dc2626'};
      ">${b.activo ? '● Activa' : '○ Inactiva'}</span>
    </div>
  `).join('');
}

/** Renderiza la tabla de usuarios en el panel SuperAdmin */
function renderUsersTable(users) {
  const tbody = document.getElementById('saUsersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">
      No hay usuarios registrados aún. Crea el primero con "+ Nuevo Usuario".
    </td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const badge = SA_ROL_BADGES[u.rol] || { label: u.rol, color: '#374151', bg: '#f3f4f6' };
    const planLabels = { basica: '⭐ Básico', pro: '🚀 Pro', premium: '💎 Premium' };
    const planBadge = u.plan ? `<div style="font-size:0.68rem; color:#4f46e5; font-weight:700; margin-top:2px;">${planLabels[u.plan] || u.plan}</div>` : '';
    const isTenant = u.isNewTenant || (u.tenantId && u.tenantId !== 'demo_carlos_ana');
    const tenantTag = isTenant
      ? `<span style="background:rgba(99,102,241,0.12); color:#4f46e5; padding:2px 7px; border-radius:6px; font-size:0.7rem; font-weight:700;">🏢 ${u.businessName || 'Nuevo Negocio'}</span>${planBadge}`
      : `<span style="font-size:0.78rem; color:var(--text-muted);">${getSucursalLabel(u.sucursal)}</span>`;

    return `
      <tr>
        <td><code style="font-size:0.82rem;background:var(--bg-hover);padding:2px 7px;border-radius:5px;font-weight:700;">${u.username}</code></td>
        <td>
          <strong>${u.nombre}</strong>
          ${u.businessName && u.businessName !== u.nombre ? `<div style="font-size:0.72rem; color:var(--text-muted);">${u.businessName}</div>` : ''}
        </td>
        <td>
          <span style="background:${badge.bg};color:${badge.color};padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;">
            ${badge.label}
          </span>
        </td>
        <td>${tenantTag}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${u.email || '<em>(Sin correo)</em>'}</td>
        <td>
          <span style="background:${u.activo !== false ? '#d1fae5' : '#fee2e2'};color:${u.activo !== false ? '#047857' : '#dc2626'};padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:700;">
            ${u.activo !== false ? '● Activo' : '○ Inactivo'}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-xs" style="font-size:0.72rem;padding:3px 8px;" onclick="saDeleteUser('${u.username || u._fsId}')" title="Eliminar usuario">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

/** Actualiza el grid de tarjetas en la pantalla de bloqueo */
function renderPinLockUserGrid() {
  const grid = document.getElementById('pinUserGrid');
  if (!grid) return;

  const users = Object.values(USERS_DB);
  grid.innerHTML = users.map(u => {
    const badge = SA_ROL_BADGES[u.roleKey] || { label: u.roleTitle };
    return `
      <div class="pin-user-card" onclick="selectLockUser('${u.key}')" data-user="${u.key}">
        <div class="pin-user-avatar">
          <img src="${u.avatar}" alt="${u.name}" onerror="this.src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80'">
        </div>
        <strong>${u.name}</strong>
        <span class="pin-user-role">${badge.label}</span>
        <small class="pin-hint">${u.sucursal ? getSucursalLabel(u.sucursal) : ''}</small>
      </div>
    `;
  }).join('');

  // Re-apply active class
  selectLockUser(activeLockUserKey);
}

// ==========================================================================
// GUARDAR NUEVO USUARIO / INQUILINO → FIRESTORE (BASE EN BLANCO O SUCURSAL)
// ==========================================================================

function toggleAccountTypeFields(type) {
  const tenantBox = document.getElementById('nuTenantFields');
  const branchBox = document.getElementById('nuBranchContainer');
  if (tenantBox) tenantBox.style.display = type === 'new_tenant' ? 'block' : 'none';
  if (branchBox) branchBox.style.display = type === 'branch_employee' ? 'block' : 'none';
}

function toggleInlineAccountType(type) {
  const tenantBox = document.getElementById('saInlineTenantFields');
  if (tenantBox) tenantBox.style.display = type === 'new_tenant' ? 'block' : 'none';
}

async function saveInlineNewUser() {
  const accountType  = document.querySelector('input[name="saInlineAccountType"]:checked')?.value || 'new_tenant';
  const isNewTenant  = accountType === 'new_tenant';
  const businessName = document.getElementById('saInBusinessName')?.value.trim() || 'Nuevo Comercio';
  const businessType = document.getElementById('saInBusinessType')?.value || 'panaderia';
  const plan         = document.getElementById('saInPlan')?.value || 'pro';

  const username = document.getElementById('saInUsername')?.value.trim();
  const nombre   = document.getElementById('saInNombre')?.value.trim();
  const rol      = document.getElementById('saInRol')?.value || 'admin';
  const pin      = document.getElementById('saInPin')?.value.trim();
  const email    = document.getElementById('saInEmail')?.value.trim() || ''; // OPCIONAL
  const errEl    = document.getElementById('saInErrorMsg');

  // ── Validaciones ──
  if (isNewTenant && !businessName) {
    if (errEl) errEl.textContent = '⚠️ Ingresa el nombre del nuevo negocio o comercio.';
    return;
  }
  if (!username || !nombre || !pin) {
    if (errEl) errEl.textContent = '⚠️ Completa el ID de usuario, nombre y PIN.';
    return;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    if (errEl) errEl.textContent = '⚠️ El ID de usuario solo permite letras minúsculas, números y guión bajo.';
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    if (errEl) errEl.textContent = '⚠️ El PIN debe ser exactamente 4 dígitos numéricos.';
    return;
  }
  if (USERS_DB[username]) {
    if (errEl) errEl.textContent = `⚠️ El usuario "${username}" ya existe en el sistema. Elige otro ID.`;
    return;
  }

  if (errEl) errEl.textContent = '';

  const tenantId = isNewTenant ? `tenant_${username}` : 'demo_carlos_ana';

  // ── Construir objeto usuario ──
  const newUser = {
    username,
    nombre,
    rol,
    sucursal: 'central',
    pin,
    email,
    plan,
    tenantId,
    businessName: isNewTenant ? businessName : 'Panadería de Carlos y Ana',
    businessType: isNewTenant ? businessType : 'panaderia',
    isNewTenant,
    activo:    true,
    createdAt: new Date().toISOString(),
    createdBy: 'memo96cr@hotmail.com (SuperAdmin)',
    avatar:    `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=4f46e5&color=fff&size=100`
  };

  const btn = document.getElementById('btnSaveInlineUser');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-circle"></i> Creando y Sincronizando…'; lucide.createIcons(); }

  try {
    if (firestoreDB) {
      const batch = firestoreDB.batch();

      // Guardar documento en colección `usuarios`
      const userRef = firestoreDB.collection('usuarios').doc(username);
      batch.set(userRef, newUser);

      // Si es Nuevo Negocio: inicializar estructura en blanco en Firestore
      if (isNewTenant) {
        const negocioRef = firestoreDB.collection('negocios').doc(tenantId);
        batch.set(negocioRef, {
          tenantId,
          businessName,
          businessType,
          plan,
          ownerUser: username,
          createdAt: new Date().toISOString(),
          initialStatus: 'blank_clean_slate',
          totalProducts: 0,
          totalRecipes: 0
        });

        // Almacén en blanco (0 productos)
        const almacenRef = firestoreDB.collection(`almacen_${tenantId}`).doc('actual');
        batch.set(almacenRef, {
          tenantId,
          businessName,
          items: [],
          lastUpdated: new Date().toISOString()
        });

        // Caja en blanco
        const cajaRef = firestoreDB.collection(`caja_${tenantId}`).doc('turno_actual');
        batch.set(cajaRef, {
          tenantId,
          cashRegister: {
            status: 'closed',
            openedAt: null,
            initialFloat: 0,
            cashSales: 0,
            electronicSales: 0,
            expenses: 0,
            movements: []
          },
          lastUpdated: new Date().toISOString()
        });

        // Recetas en blanco
        const recetasRef = firestoreDB.collection(`recetas_${tenantId}`).doc('actual');
        batch.set(recetasRef, {
          tenantId,
          recipes: [],
          orders: [],
          lastUpdated: new Date().toISOString()
        });
      }

      await batch.commit();

      if (isNewTenant) {
        showToast(`✨ ¡Negocio "${businessName}" (${username}) creado con Base de Datos en Blanco en Firestore!`, 'success');
      } else {
        showToast(`✅ Usuario "${username}" creado y sincronizado con Firestore.`, 'success');
      }

    } else {
      USERS_DB[username] = {
        key:          username,
        name:         nombre,
        roleTitle:    getRolTitle(rol),
        roleKey:      rol,
        pin,
        bodyClass:    getRolBodyClass(rol),
        homeView:     getRolHomeView(rol),
        avatar:       newUser.avatar,
        sucursal:     'central',
        email,
        tenantId,
        businessName: newUser.businessName,
        isNewTenant
      };
      renderUsersTableLocal();
      showToast(`⚠️ Usuario "${username}" guardado localmente (Firestore offline).`, 'warning');
    }

    // Auditoría
    appState.auditLogs.unshift({
      time:   new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user:   'memo96cr@hotmail.com',
      role:   'SuperAdmin',
      module: 'SuperAdmin → Negocios & Usuarios',
      action: isNewTenant
        ? `Nuevo Comercio Creado: ${businessName} (${username}) con Base de Datos en Blanco`
        : `Usuario Creado: ${username} (${nombre}) · Rol: ${rol}`,
      ip:     '–'
    });
    saveState();

    // Limpiar formulario inline
    ['saInBusinessName','saInUsername','saInNombre','saInPin','saInEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  } catch (err) {
    console.error('[SuperAdmin] Error al guardar usuario inline:', err);
    if (errEl) errEl.textContent = '❌ Error al guardar: ' + (err.message || err);
    showToast('❌ Error al sincronizar con Firestore.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Crear Negocio / Usuario y Sincronizar en Firestore'; lucide.createIcons(); }
  }
}

async function saveNewUser() {
  const accountType  = document.querySelector('input[name="nuAccountType"]:checked')?.value || 'new_tenant';
  const isNewTenant  = accountType === 'new_tenant';
  const businessName = document.getElementById('nuBusinessName')?.value.trim() || 'Nuevo Comercio';
  const businessType = document.getElementById('nuBusinessType')?.value || 'panaderia';

  const username = document.getElementById('nuUsername')?.value.trim();
  const nombre   = document.getElementById('nuNombre')?.value.trim();
  const rol      = document.getElementById('nuRol')?.value || 'admin';
  const sucursal = isNewTenant ? 'central' : (document.getElementById('nuSucursal')?.value || 'central');
  const pin      = document.getElementById('nuPin')?.value.trim();
  const email    = document.getElementById('nuEmail')?.value.trim() || ''; // OPCIONAL
  const errEl    = document.getElementById('nuErrorMsg');

  // ── Validaciones ──
  if (isNewTenant && !businessName) {
    if (errEl) errEl.textContent = '⚠️ Ingresa el nombre del nuevo negocio o comercio.';
    return;
  }
  if (!username || !nombre || !pin) {
    if (errEl) errEl.textContent = '⚠️ Completa el ID de usuario, nombre y PIN.';
    return;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    if (errEl) errEl.textContent = '⚠️ El ID de usuario solo permite letras minúsculas, números y guión bajo.';
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    if (errEl) errEl.textContent = '⚠️ El PIN debe ser exactamente 4 dígitos numéricos.';
    return;
  }
  if (USERS_DB[username]) {
    if (errEl) errEl.textContent = `⚠️ El usuario "${username}" ya existe en el sistema. Elige otro ID.`;
    return;
  }

  if (errEl) errEl.textContent = '';

  const tenantId = isNewTenant ? `tenant_${username}` : 'demo_carlos_ana';

  // ── Construir objeto usuario ──
  const newUser = {
    username,
    nombre,
    rol,
    sucursal,
    pin,
    email, // Puede ser vacío
    tenantId,
    businessName: isNewTenant ? businessName : 'Panadería de Carlos y Ana',
    businessType: isNewTenant ? businessType : 'panaderia',
    isNewTenant,
    activo:    true,
    createdAt: new Date().toISOString(),
    createdBy: 'memo96cr@hotmail.com (SuperAdmin)',
    avatar:    `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=4f46e5&color=fff&size=100`
  };

  // ── Deshabilitar botón mientras guarda ──
  const btn = document.getElementById('btnSaveNewUser');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-circle"></i> Creando y Sincronizando…'; lucide.createIcons(); }

  try {
    if (firestoreDB) {
      const batch = firestoreDB.batch();

      // 1. Guardar documento en colección `usuarios`
      const userRef = firestoreDB.collection('usuarios').doc(username);
      batch.set(userRef, newUser);

      // 2. Si es Nuevo Negocio: INICIALIZAR BASE DE DATOS EN BLANCO AISLADA EN FIRESTORE
      if (isNewTenant) {
        // Documento de metadatos del negocio
        const negocioRef = firestoreDB.collection('negocios').doc(tenantId);
        batch.set(negocioRef, {
          tenantId,
          businessName,
          businessType,
          ownerUser: username,
          createdAt: new Date().toISOString(),
          initialStatus: 'blank_clean_slate',
          totalProducts: 0,
          totalRecipes: 0
        });

        // Colección aislada de almacén: TOTALMENTE EN BLANCO (0 productos precargados)
        const almacenRef = firestoreDB.collection(`almacen_${tenantId}`).doc('actual');
        batch.set(almacenRef, {
          tenantId,
          businessName,
          items: [], // Base limpia en blanco
          lastUpdated: new Date().toISOString()
        });

        // Colección aislada de caja: TOTALMENTE EN BLANCO
        const cajaRef = firestoreDB.collection(`caja_${tenantId}`).doc('turno_actual');
        batch.set(cajaRef, {
          tenantId,
          cashRegister: {
            status: 'closed',
            openedAt: null,
            initialFloat: 0,
            cashSales: 0,
            electronicSales: 0,
            expenses: 0,
            movements: []
          },
          lastUpdated: new Date().toISOString()
        });

        // Colección aislada de producción / recetas: TOTALMENTE EN BLANCO
        const recetasRef = firestoreDB.collection(`recetas_${tenantId}`).doc('actual');
        batch.set(recetasRef, {
          tenantId,
          recipes: [],
          orders: [],
          lastUpdated: new Date().toISOString()
        });
      }

      await batch.commit();

      if (isNewTenant) {
        showToast(`✨ ¡Negocio "${businessName}" (${username}) creado con Base de Datos en Blanco en Firestore!`, 'success');
      } else {
        showToast(`✅ Usuario "${username}" creado y sincronizado con Firestore.`, 'success');
      }

    } else {
      // Modo offline local
      USERS_DB[username] = {
        key:          username,
        name:         nombre,
        roleTitle:    getRolTitle(rol),
        roleKey:      rol,
        pin,
        bodyClass:    getRolBodyClass(rol),
        homeView:     getRolHomeView(rol),
        avatar:       newUser.avatar,
        sucursal,
        email,
        tenantId,
        businessName: newUser.businessName,
        isNewTenant
      };
      renderUsersTableLocal();
      showToast(`⚠️ Usuario "${username}" guardado localmente (Firestore offline).`, 'warning');
    }

    // Auditoría
    appState.auditLogs.unshift({
      time:   new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user:   'memo96cr@hotmail.com',
      role:   'SuperAdmin',
      module: 'SuperAdmin → Negocios & Usuarios',
      action: isNewTenant
        ? `Nuevo Comercio Creado: ${businessName} (${username}) con Base de Datos en Blanco`
        : `Usuario Creado: ${username} (${nombre}) · Rol: ${rol}`,
      ip:     '–'
    });
    saveState();

    closeModal('newUserModal');
    // Limpiar formulario
    ['nuBusinessName','nuUsername','nuNombre','nuPin','nuEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('nuRol').value = 'admin';

  } catch (err) {
    console.error('[SuperAdmin] Error al guardar usuario/negocio:', err);
    if (errEl) errEl.textContent = '❌ Error al guardar: ' + (err.message || err);
    showToast('❌ Error al sincronizar con Firestore.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Crear y Sincronizar en Firestore'; lucide.createIcons(); }
  }
}

/** Elimina un usuario de Firestore y de USERS_DB local */
async function saDeleteUser(username) {
  if (!confirm(`¿Seguro que deseas eliminar al usuario/negocio "${username}"?`)) return;

  try {
    if (firestoreDB) {
      await firestoreDB.collection('usuarios').doc(username).delete();
    }
    delete USERS_DB[username];
    renderUsersTableLocal();
    showToast(`🗑️ Usuario "${username}" eliminado.`, 'info');

    appState.auditLogs.unshift({
      time:   new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user:   'memo96cr@hotmail.com',
      role:   'SuperAdmin',
      module: 'SuperAdmin → Usuarios',
      action: `Usuario eliminado: ${username}`,
      ip:     '–'
    });
    saveState();
  } catch (err) {
    showToast('❌ Error al eliminar: ' + (err.message || err), 'error');
  }
}

// ==========================================================================
// HELPERS DE ROL
// ==========================================================================
function getRolTitle(rol) {
  return { admin: 'Administrador', cajero: 'Cajero / Mostrador', chef: 'Panadero / Chef', logistica: 'Repartidor' }[rol] || rol;
}
function getRolBodyClass(rol) {
  return { admin: 'role-admin', cajero: 'role-mostrador', chef: 'role-panadero', logistica: 'role-repartidor' }[rol] || 'role-admin';
}
function getRolHomeView(rol) {
  return { admin: 'dashboard', cajero: 'pos', chef: 'produccion', logistica: 'logistica' }[rol] || 'dashboard';
}
function getSucursalLabel(id) {
  return { central: '🏠 Central', norte: '🏪 Norte', gourmet: '☕ Gourmet' }[id] || id;
}


// ==========================================================================
// MÓDULO DE CONFIGURACIÓN DE HARDWARE & PERIFÉRICOS POS
// Impresoras Térmicas (58mm/80mm, USB/Red/BT) & Lectores de Códigos de Barras
// ==========================================================================

const HARDWARE_CONFIG_KEY = 'bakemaster_hardware_config_v1';

const DEFAULT_HARDWARE_CONFIG = {
  printer: {
    port: 'usb',
    ip: '192.168.1.200',
    rawPort: 9100,
    paperWidth: '58', // '58' | '80'
    header: 'BakeMaster Pro · Panadería Artesanal',
    footer: '¡Gracias por preferir nuestro pan recién horneado!',
    optCutter: true,
    optDrawer: true,
    optBarcode: true
  },
  scanner: {
    active: true,
    suffix: 'enter',
    minLen: 4,
    audioBeep: true,
    autoPOS: true,
    bufferMs: 60
  }
};

let hardwareConfig = (() => {
  const saved = localStorage.getItem(HARDWARE_CONFIG_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_HARDWARE_CONFIG));
})();

function saveHardwareStorage() {
  localStorage.setItem(HARDWARE_CONFIG_KEY, JSON.stringify(hardwareConfig));
}

function initHardwareSettingsUI() {
  // Impresora
  const p = hardwareConfig.printer;
  const portSelect = document.getElementById('hwPrinterPort');
  if (portSelect) portSelect.value = p.port;

  const ipEl = document.getElementById('hwPrinterIp');
  if (ipEl) ipEl.value = p.ip;

  const rawPortEl = document.getElementById('hwPrinterNetworkPort');
  if (rawPortEl) rawPortEl.value = p.rawPort;

  const widthRadios = document.querySelectorAll('input[name="hwPaperWidth"]');
  widthRadios.forEach(r => { r.checked = (r.value === p.paperWidth); });

  const headerEl = document.getElementById('hwTicketHeader');
  if (headerEl) headerEl.value = p.header;

  const footerEl = document.getElementById('hwTicketFooter');
  if (footerEl) footerEl.value = p.footer;

  const cutterEl = document.getElementById('hwOptCutter');
  if (cutterEl) cutterEl.checked = p.optCutter;

  const drawerEl = document.getElementById('hwOptDrawer');
  if (drawerEl) drawerEl.checked = p.optDrawer;

  const barcodeEl = document.getElementById('hwOptBarcode');
  if (barcodeEl) barcodeEl.checked = p.optBarcode;

  togglePrinterNetworkFields();

  // Escáner
  const s = hardwareConfig.scanner;
  const activeEl = document.getElementById('hwScannerActive');
  if (activeEl) activeEl.checked = s.active;

  const suffixEl = document.getElementById('hwScannerSuffix');
  if (suffixEl) suffixEl.value = s.suffix;

  const minLenEl = document.getElementById('hwScannerMinLen');
  if (minLenEl) minLenEl.value = s.minLen;

  const beepEl = document.getElementById('hwOptAudioBeep');
  if (beepEl) beepEl.checked = s.audioBeep;

  const autoPosEl = document.getElementById('hwOptAutoPOS');
  if (autoPosEl) autoPosEl.checked = s.autoPOS;

  updateHardwareStatusBadges();
}

function togglePrinterNetworkFields() {
  const port = document.getElementById('hwPrinterPort')?.value;
  const netFields = document.getElementById('hwNetworkFields');
  if (netFields) {
    netFields.style.display = port === 'network' ? 'block' : 'none';
  }
}

function updatePaperWidthUI() {
  // Callback when radio changes
}

function updateHardwareStatusBadges() {
  const pBadge = document.getElementById('hwStatusBadgePrinter');
  const sBadge = document.getElementById('hwStatusBadgeScanner');
  if (pBadge) {
    pBadge.innerHTML = `<i data-lucide="check-circle" style="width:12px; height:12px; vertical-align:-1px;"></i> Impresora: ${hardwareConfig.printer.paperWidth}mm (${hardwareConfig.printer.port.toUpperCase()})`;
  }
  if (sBadge) {
    sBadge.className = hardwareConfig.scanner.active ? 'badge badge-primary' : 'badge badge-warning';
    sBadge.innerHTML = hardwareConfig.scanner.active
      ? '<i data-lucide="scan" style="width:12px; height:12px; vertical-align:-1px;"></i> Lector: Activo (HID)'
      : '<i data-lucide="scan-line" style="width:12px; height:12px; vertical-align:-1px;"></i> Lector: Desactivado';
  }
  lucide.createIcons();
}

function saveHardwarePrinterConfig() {
  hardwareConfig.printer = {
    port: document.getElementById('hwPrinterPort')?.value || 'usb',
    ip: document.getElementById('hwPrinterIp')?.value.trim() || '192.168.1.200',
    rawPort: parseInt(document.getElementById('hwPrinterNetworkPort')?.value) || 9100,
    paperWidth: document.querySelector('input[name="hwPaperWidth"]:checked')?.value || '58',
    header: document.getElementById('hwTicketHeader')?.value.trim() || 'BakeMaster Pro',
    footer: document.getElementById('hwTicketFooter')?.value.trim() || '¡Gracias por su compra!',
    optCutter: document.getElementById('hwOptCutter')?.checked ?? true,
    optDrawer: document.getElementById('hwOptDrawer')?.checked ?? true,
    optBarcode: document.getElementById('hwOptBarcode')?.checked ?? true
  };
  saveHardwareStorage();
  updateHardwareStatusBadges();
  showToast('💾 Configuración de impresora guardada con éxito.', 'success');
}

function saveHardwareScannerConfig() {
  hardwareConfig.scanner = {
    active: document.getElementById('hwScannerActive')?.checked ?? true,
    suffix: document.getElementById('hwScannerSuffix')?.value || 'enter',
    minLen: parseInt(document.getElementById('hwScannerMinLen')?.value) || 4,
    audioBeep: document.getElementById('hwOptAudioBeep')?.checked ?? true,
    autoPOS: document.getElementById('hwOptAutoPOS')?.checked ?? true,
    bufferMs: 60
  };
  saveHardwareStorage();
  updateHardwareStatusBadges();
  showToast('💾 Configuración del lector de código de barras guardada.', 'success');
}

function toggleBarcodeListenerState(isActive) {
  hardwareConfig.scanner.active = isActive;
  saveHardwareStorage();
  updateHardwareStatusBadges();
  showToast(isActive ? '📟 Modo escucha de lector activado.' : '⏸️ Modo escucha de lector pausado.', 'info');
}

/** Reproduce un pitido sintético de confirmación de escaneo (Web Audio API) */
function playScannerBeep(freq = 1800, duration = 0.08) {
  if (!hardwareConfig.scanner.audioBeep) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Fallback if audio context is blocked
  }
}

/** Imprime un ticket de prueba térmico fotorrealista para 58mm u 80mm */
function printHardwareTestTicket() {
  const p = hardwareConfig.printer;
  const is58 = p.paperWidth === '58';
  const widthPx = is58 ? '260px' : '360px';
  const nowStr = new Date().toLocaleString('es-CR');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('⚠️ Habilita ventanas emergentes para ver e imprimir el ticket.', 'warning');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket de Prueba ${p.paperWidth}mm - BakeMaster Pro</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; }
        body { background: #f1f5f9; display: flex; justify-content: center; padding: 20px; color: #000; font-size: ${is58 ? '11px' : '13px'}; }
        .ticket { width: ${widthPx}; background: #fff; padding: 14px 10px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .double-divider { border-top: 2px dashed #000; margin: 8px 0; }
        .table-items { width: 100%; border-collapse: collapse; margin: 6px 0; }
        .table-items td { padding: 2px 0; vertical-align: top; }
        .barcode-box { text-align: center; font-family: monospace; letter-spacing: 4px; font-weight: bold; margin: 8px 0; }
        .cut-indicator { border-top: 1px dotted #999; margin-top: 15px; padding-top: 4px; text-align: center; font-size: 9px; color: #666; }
        @media print {
          body { background: #fff; padding: 0; }
          .ticket { width: 100%; box-shadow: none; padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="text-center bold" style="font-size: ${is58 ? '13px' : '15px'};">${p.header}</div>
        <div class="text-center" style="font-size: 10px; margin-top: 2px;">Céd. Jurídica: 3-101-884920 · CDMX / San José</div>
        <div class="text-center" style="font-size: 10px;">Sucursal Central · Terminal POS-01</div>
        <div class="divider"></div>
        <div class="text-center bold">*** TICKET DE PRUEBA DE HARDWARE ***</div>
        <div class="text-center" style="font-size:10px;">Formato: ${p.paperWidth}mm · Puerto: ${p.port.toUpperCase()}</div>
        <div class="text-center" style="font-size:10px;">Fecha: ${nowStr}</div>
        <div class="divider"></div>
        <table class="table-items">
          <tr><td class="bold">1x Croissant Mantequilla</td><td class="text-right">₡1,600</td></tr>
          <tr><td class="bold">2x Baguette Masa Madre</td><td class="text-right">₡2,400</td></tr>
          <tr><td class="bold">1x Café Tarrazú Doble</td><td class="text-right">₡1,500</td></tr>
        </table>
        <div class="divider"></div>
        <table style="width: 100%;">
          <tr><td>SUBTOTAL:</td><td class="text-right">₡5,500</td></tr>
          <tr><td>I.V.A. (13%):</td><td class="text-right">₡715</td></tr>
          <tr class="bold" style="font-size: ${is58 ? '13px' : '15px'};"><td>TOTAL:</td><td class="text-right">₡6,215</td></tr>
        </table>
        <div class="double-divider"></div>
        <div class="text-center bold">PAGO: EFECTIVO (₡10,000) · CAMBIO: ₡3,785</div>
        ${p.optBarcode ? `
          <div class="barcode-box">
            ||| | |||| || | |||| ||||<br>
            *TEST-REC-9941*
          </div>
        ` : ''}
        <div class="text-center" style="margin-top: 6px; font-size: 10px;">${p.footer}</div>
        ${p.optDrawer ? '<div class="text-center" style="font-size:8px;color:#888;margin-top:4px;">[ESC p: Pulso Cajón Enviado]</div>' : ''}
        ${p.optCutter ? '<div class="cut-indicator">--- CORTE DE PAPEL (GS V) ---</div>' : ''}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
  showToast(`🖨️ Imprimiendo Ticket de Prueba (${p.paperWidth}mm - ${p.port.toUpperCase()})`, 'info');
}

/** Manejador del campo interactivo de prueba rápida de escaneo */
let _lastScanStartTime = 0;
function handleScannerTestKeydown(e) {
  if (!_lastScanStartTime) _lastScanStartTime = performance.now();

  if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.getElementById('hwScannerTestInput');
    const val = input ? input.value.trim() : '';
    const elapsed = Math.round(performance.now() - _lastScanStartTime);
    _lastScanStartTime = 0;

    if (!val) return;

    playScannerBeep();

    const resultBox = document.getElementById('hwScannerLiveResult');
    if (resultBox) {
      resultBox.innerHTML = `
        <div style="background:#ecfdf5; border:1px solid #86efac; color:#065f46; padding:6px 14px; border-radius:999px; font-size:0.82rem; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
          <span>✅ Código Leído:</span>
          <code style="background:#d1fae5; padding:2px 6px; border-radius:4px; font-family:monospace;">${val}</code>
          <span style="font-size:0.72rem; color:#047857;">(${elapsed} ms)</span>
        </div>
      `;
    }

    // Buscar si el producto existe en el inventario actual
    const matched = appState.inventory.find(i => (i.code && i.code.toLowerCase() === val.toLowerCase()) || (i.lot && i.lot.toLowerCase() === val.toLowerCase()) || (i.id && i.id.toLowerCase() === val.toLowerCase()));
    if (matched) {
      showToast(`🎯 Producto detectado: "${matched.name}" (Precio: ₡${matched.pvp ? formatNumber(matched.pvp) : 'N/A'})`, 'success');
    } else {
      showToast(`⚡ Código escaneado: "${val}" (Lectura en ${elapsed}ms)`, 'info');
    }

    setTimeout(() => { if (input) { input.value = ''; input.focus(); } }, 400);
  }
}

// ─── GLOBAL KEYBOARD WEDGE LISTENER (USB HID SCANNERS) ───
let _scannerBuffer = '';
let _scannerLastKeyTime = 0;

document.addEventListener('keydown', (e) => {
  if (!hardwareConfig.scanner.active) return;

  // Don't intercept when focusing regular long textareas or non-POS inputs unless it's fast
  const targetTag = e.target.tagName;
  const isInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA';
  const isPosView = document.getElementById('view-pos')?.classList.contains('active');

  const now = performance.now();
  const timeDiff = now - _scannerLastKeyTime;
  _scannerLastKeyTime = now;

  if (e.key === 'Enter') {
    if (_scannerBuffer.length >= (hardwareConfig.scanner.minLen || 4)) {
      const code = _scannerBuffer.trim();
      _scannerBuffer = '';

      playScannerBeep();

      if (isPosView || hardwareConfig.scanner.autoPOS) {
        // Find product in inventory by barcode / code / lot
        const prod = appState.inventory.find(i => 
          (i.code && i.code.toLowerCase() === code.toLowerCase()) || 
          (i.lot && i.lot.toLowerCase() === code.toLowerCase()) ||
          (i.id && i.id.toLowerCase() === code.toLowerCase())
        );

        if (prod) {
          addToCart(prod.id);
          showToast(`🛒 Escaneado: +1 "${prod.name}" agregado al carrito (₡${formatNumber(prod.pvp)})`, 'success');
        } else {
          showToast(`📟 Código escaneado: ${code} (No encontrado en catálogo)`, 'warning');
        }
      }
    }
    _scannerBuffer = '';
    return;
  }

  // Barcode scanner sends chars with < 50ms interval
  if (e.key.length === 1) {
    if (timeDiff < (hardwareConfig.scanner.bufferMs || 60)) {
      _scannerBuffer += e.key;
    } else {
      _scannerBuffer = e.key;
    }
  }
});


