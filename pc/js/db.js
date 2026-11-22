// ⚠️ PEGA AQUÍ TUS CREDENCIALES ⚠️
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ⚙️ Configuración general del sistema (un solo lugar para cambiarla)
const SMARTPOS_CONFIG = {
    IVA_RATE: 0.18,   // 18 % de IVA
    MONEDA: '$'       // Símbolo de moneda mostrado en pantalla y tickets
};