// Баррель-экспорт всех схем БД
export * from './users';
export * from './designs';
export * from './services';
export * from './orders';
export * from './schedules';
export * from './reviews';
export * from './comments';
export * from './notifications';
export * from './messages';
export * from './sms-codes';

// Реэкспорт для удобства
export { users } from './users';
export { adminProfiles, clientProfiles, masterProfiles } from './users';
export { nailDesigns, masterDesigns, clientLikedDesigns } from './designs';
export { masterServices, masterServiceDesigns } from './services';
export { orders, orderDesignSnapshots } from './orders';
export { schedules } from './schedules';
export { reviews, masterRatings } from './reviews';
export { comments, commentLikes } from './comments';
export { notifications } from './notifications';
export { messages } from './messages';
