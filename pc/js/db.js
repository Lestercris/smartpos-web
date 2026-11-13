// ⚠️ PEGA AQUÍ TUS CREDENCIALES ⚠️
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales para el carrito
let carrito = [];
const IVA_RATE = 0.21; // 21% de IVA