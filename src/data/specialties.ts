// Специализации мастеров маникюра
export const MASTER_SPECIALTIES = [
  'Классический маникюр', 'Аппаратный маникюр', 'Гель-лак',
  'Наращивание ногтей', 'Дизайн ногтей', 'Педикюр',
  'Парафинотерапия', 'Стемпинг', 'Роспись ногтей',
  'Французский маникюр',
] as const;

export type MasterSpecialty = (typeof MASTER_SPECIALTIES)[number];

// Города (US — Nominatim geocoding tested)
export const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'San Francisco',
  'Miami', 'Boston', 'Seattle', 'Austin', 'Denver', 'Portland',
] as const;

export type City = (typeof CITIES)[number];
