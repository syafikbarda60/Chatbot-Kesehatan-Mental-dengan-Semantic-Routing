// How to keep Sajiwa's greetings and reminders arriving on this phone. The OS draws every
// notification itself, so the app cannot restyle them per brand; what does differ per brand is
// the battery manager, and on several Android skins it silently drops scheduled notifications.
// Pure, so it is unit-tested with plain Node (`npm run test:unit`).

export type NotificationTips = { label: string; steps: string[] };

const LAST = 'Pastikan notifikasi Sajiwa diizinkan di pengaturan aplikasi (tombol di bawah).';

const ANDROID: { brands: string[]; tips: NotificationTips }[] = [
  { brands: ['xiaomi', 'redmi', 'poco'], tips: { label: 'Xiaomi / Redmi / POCO', steps: [
    'Buka Keamanan → Izin → Mulai otomatis, lalu aktifkan Sajiwa.',
    'Di Info aplikasi Sajiwa → Penghemat baterai, pilih Tanpa batasan.',
    LAST,
  ] } },
  { brands: ['oppo', 'realme', 'oneplus'], tips: { label: 'OPPO / realme / OnePlus', steps: [
    'Di Info aplikasi Sajiwa → Penggunaan baterai, izinkan aktivitas latar belakang.',
    'Aktifkan juga Mulai otomatis untuk Sajiwa.',
    LAST,
  ] } },
  { brands: ['vivo', 'iqoo'], tips: { label: 'vivo / iQOO', steps: [
    'Buka i Manager → Manajemen aplikasi → Mulai otomatis, lalu aktifkan Sajiwa.',
    'Di Baterai, izinkan Sajiwa memakai daya tinggi di latar belakang.',
    LAST,
  ] } },
  { brands: ['huawei', 'honor'], tips: { label: 'Huawei / Honor', steps: [
    'Buka Baterai → Peluncuran aplikasi → Sajiwa → Kelola secara manual, lalu aktifkan ketiganya.',
    LAST,
  ] } },
  { brands: ['samsung'], tips: { label: 'Samsung', steps: [
    'Buka Baterai → Batas penggunaan latar belakang, pastikan Sajiwa tidak masuk Aplikasi tidur.',
    LAST,
  ] } },
];

export function notificationTips(os: 'android' | 'ios' | string, brand: string | null | undefined): NotificationTips {
  if (os === 'ios') {
    return { label: 'iPhone', steps: [
      'Jika Ringkasan Terjadwal aktif, keluarkan Sajiwa darinya agar sapaan datang tepat waktu.',
      LAST,
    ] };
  }
  const key = (brand ?? '').toLowerCase();
  return ANDROID.find((entry) => entry.brands.includes(key))?.tips ?? { label: 'Android', steps: [LAST] };
}
