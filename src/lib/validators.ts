import { z } from 'zod';

// ============================================================
// Auth schemas
// ============================================================
export const registerSchema = z.object({
  phone: z.string().min(10, 'Введите телефон').max(20),
  fullName: z.string().min(2, 'Введите имя').max(255),
  password: z
    .string()
    .min(6, 'Минимум 6 символов')
    .max(255),
  role: z.enum(['client', 'nailmaster']),
});

export const loginSchema = z.object({
  phone: z.string().min(10, 'Введите телефон'),
  password: z.string().min(1, 'Введите пароль'),
});

export const registerAdminSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(255),
  password: z.string().min(8),
  fullName: z.string().min(2).max(255),
  phone: z.string().min(10).max(20),
  secret: z.string().min(1, 'Требуется секретный ключ'),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(255).optional(),
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().min(10).max(20).optional(),
  age: z.number().min(14).max(120).optional(),
  avatarUrl: z.string().optional(),
  role: z.enum(['client', 'nailmaster']).optional(),
});

// ============================================================
// Design schemas
// ============================================================
export const createDesignSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(255),
  type: z.enum(['basic', 'designer']).optional().default('basic'),
  description: z.string().max(5000).optional(),
  images: z.array(z.string()).optional().default([]),
  videoUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().max(100).optional(),
  colors: z.array(z.object({ hex: z.string(), lab: z.array(z.number()) })).optional(),
  techniques: z.array(z.string()).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  shape: z.enum(['square', 'soft_square', 'almond', 'oval', 'stiletto', 'ballerina']).optional(),
  occasionTags: z.array(z.string()).optional(),
  moodTags: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  decorTags: z.array(z.string()).optional(),
  durationMinutes: z.number().int().positive().optional(),
  season: z.enum(['spring', 'summer', 'fall', 'winter']).optional(),
  trendTags: z.array(z.string()).optional(),
  serviceFormat: z.enum(['salon', 'home', 'both']).optional(),
});

export const createDesignSchemaRefined = createDesignSchema.refine(
  d => (d.images?.length || 0) > 0 || (d.videoUrl?.length || 0) > 0,
  { message: 'Загрузите изображение или видео' },
);

export const updateDesignSchema = createDesignSchema.partial();

export const designFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['basic', 'designer']).optional(),
  source: z.enum(['admin', 'client', 'master']).optional(),
  color: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  length: z.string().optional(),
  shape: z.string().optional(),
  season: z.string().optional(),
  technique: z.string().optional(),
  mood: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['likes', 'newest', 'popular']).default('newest'),
  includeOwn: z.coerce.boolean().optional(),
});

// ============================================================
// Order schemas
// ============================================================
export const createOrderSchema = z.object({
  masterServiceIds: z.array(z.string().uuid()).optional(),
  masterServiceId: z.string().uuid().optional(), // backwards compat
  nailDesignId: z.string().uuid().optional(),
  nailMasterId: z.string().uuid('Некорректный ID мастера'),
  requestedDateTime: z.string().refine((s) => !isNaN(Date.parse(s)), 'Некорректная дата/время'),
  description: z.string().max(2000).optional(),
  clientNotes: z.string().max(2000).optional(),
  price: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  masterNotes: z.string().max(2000).optional(),
  proposedDateTime: z.string().refine((s) => !isNaN(Date.parse(s)), 'Некорректная дата').optional(),
});

// ============================================================
// Master schemas
// ============================================================
export const updateMasterProfileSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  address: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  phone: z.string().min(10).max(20).optional(),
  experience: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  specialties: z.array(z.string()).optional(),
  startingPrice: z.number().positive().optional(),
  workFormat: z.array(z.enum(['salon', 'home'])).optional(),
  sterilization: z.boolean().optional(),
  disposableTools: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const masterFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  city: z.string().optional(),
  specialty: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  search: z.string().optional(),
  sort: z.enum(['rating', 'orders', 'newest']).default('rating'),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  radius: z.coerce.number().positive().default(10), // km
});

// ============================================================
// Service schemas
// ============================================================
export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price: z.number().positive('Цена должна быть положительной'),
  duration: z.number().int().positive('Длительность должна быть положительной'),
});

export const updateServiceSchema = createServiceSchema.partial();

export const addDesignToServiceSchema = z.object({
  customPrice: z.number().positive().optional(),
  additionalDuration: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================
// Schedule schemas
// ============================================================
export const createTimeSlotSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат: HH:MM'),
  notes: z.string().max(1000).optional(),
});

// ============================================================
// Review schemas
// ============================================================
export const createReviewSchema = z.object({
  comment: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
  imageUrl: z.string().optional(),
  nailMasterId: z.string().uuid().optional(),
});

export const createRatingSchema = z.object({
  ratingNumber: z.number().int().min(1).max(5),
  description: z.string().max(500).optional(),
});

// ============================================================
// Comment schemas
// ============================================================
export const createCommentSchema = z.object({
  text: z.string().min(1).max(2000),
  parentCommentId: z.string().uuid().optional(),
});

// ============================================================
// Common schemas
// ============================================================
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const optionalIdParamSchema = z.object({
  id: z.string().uuid().optional(),
});

// ============================================================
// Type exports (inferred from schemas)
// ============================================================
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateDesignInput = z.infer<typeof createDesignSchema>;
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;
export type DesignFilters = z.infer<typeof designFiltersSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateMasterProfileInput = z.infer<typeof updateMasterProfileSchema>;
export type MasterFilters = z.infer<typeof masterFiltersSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateTimeSlotInput = z.infer<typeof createTimeSlotSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
