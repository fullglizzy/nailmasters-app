// ============================================================
// Общие интерфейсы данных NailMasters
// Выведены из схем БД (src/db/schema/) и ответов API-роутов.
// Все фронтенд-компоненты должны использовать эти типы.
// ============================================================

// ── API Response Wrappers ──────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
  message?: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── User & Auth ───────────────────────────────────────────

export type UserRole = 'admin' | 'nailmaster' | 'client';

export interface UserProfile {
  id: string;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  isGuest: boolean;
  blocked: boolean;
  avatarUrl?: string | null;
  age?: number | null;
  createdAt?: string | Date;
  // Client profile fields (merged)
  fullName?: string | null;
  phone?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  // Master profile fields (merged)
  address?: string | null;
  description?: string | null;
  experience?: string | null;
  city?: string | null;
  rating?: string | number;
  totalOrders?: number;
  isModerated?: boolean;
  reviewsCount?: number;
  specialties?: string[] | null;
  startingPrice?: string | number | null;
  workFormat?: string[] | null;
  sterilization?: boolean;
  disposableTools?: boolean;
  sterilizationPhoto?: string | null;
  // Admin profile fields (merged)
  permissions?: string[] | null;
  isActive?: boolean;
}

export interface TokenPayload {
  userId: string;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  isGuest: boolean;
  fullName?: string | null;
  phone?: string | null;
  avatar?: string | null;
}

// ── Design ────────────────────────────────────────────────

export type DesignType = 'basic' | 'designer';
export type DesignSource = 'admin' | 'client' | 'master';
export type NailLength = 'short' | 'medium' | 'long';
export type NailShape = 'square' | 'soft_square' | 'almond' | 'oval' | 'stiletto' | 'ballerina';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface DesignLabColor {
  hex: string;
  lab: number[];
}

export interface Design {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  videoUrl?: string | null;
  type: string;
  source: string;
  tags?: string[] | null;
  color?: string | null;
  colors?: DesignLabColor[] | null;
  techniques?: string[] | null;
  length?: string | null;
  shape?: string | null;
  occasionTags?: string[] | null;
  moodTags?: string[] | null;
  materials?: string[] | null;
  decorTags?: string[] | null;
  durationMinutes?: number | null;
  season?: string | null;
  trendTags?: string[] | null;
  serviceFormat?: string | null;
  likesCount: number;
  ordersCount: number;
  isActive: boolean;
  isModerated: boolean;
  minPrice?: string | number | null;
  uploadedByClientId?: string | null;
  uploadedByAdminId?: string | null;
  uploadedByMasterId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** Упрощённый дизайн для списков (главная, лента) */
export interface DesignListItem {
  id: string;
  title: string;
  images?: string[];
  videoUrl?: string | null;
  likesCount?: number;
  ordersCount?: number;
  isLiked?: boolean;
  tags?: string[];
}

/** Дизайн для TikTok-подобной ленты (explore). Совместим с FeedDesign из старого хука. */
export interface FeedDesign {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  videoUrl: string | null;
  likesCount: number;
  isLiked?: boolean;
  tags: string[] | null;
  techniques?: string[] | null;
  materials?: string[] | null;
  color?: string | null;
  length?: string | null;
  season?: string | null;
}

/** Полный дизайн с автором и ценами мастеров */
export interface DesignDetail extends Design {
  author?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role?: UserRole;
  } | null;
  _masterPrice?: number | null;
  _masterDuration?: number | null;
  isLiked?: boolean;
}

// ── Master ────────────────────────────────────────────────

export interface Master {
  userId: string;
  fullName: string;
  address?: string | null;
  description?: string | null;
  phone: string;
  experience?: string | null;
  city?: string | null;
  rating: string | number;
  totalOrders: number;
  isActive: boolean;
  isModerated: boolean;
  reviewsCount: number;
  specialties?: string[] | null;
  startingPrice?: string | number | null;
  workFormat?: string[] | null;
  sterilization: boolean;
  disposableTools: boolean;
  sterilizationPhoto?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  // Enriched from users table
  avatarUrl?: string | null;
  username?: string;
  distance?: number;
}

export interface MasterProfile extends Master {
  services?: Service[];
}

// ── Service ───────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  duration: number;
  isActive: boolean;
  masterId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  // Enriched
  designs?: ServiceDesign[];
}

export interface ServiceDesign {
  id: string;
  customPrice?: string | number | null;
  additionalDuration?: number | null;
  notes?: string | null;
  isActive: boolean;
  masterServiceId: string;
  nailDesignId: string;
  nailDesign?: Design;
}

// ── Order ─────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'alternative_proposed'
  | 'declined'
  | 'timeout'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  description?: string | null;
  status: string;
  price?: string | number | null;
  requestedDateTime: string | Date;
  proposedDateTime?: string | Date | null;
  confirmedDateTime?: string | Date | null;
  masterNotes?: string | null;
  clientNotes?: string | null;
  masterResponseTime?: string | Date | null;
  completedAt?: string | Date | null;
  completedBy?: string | null;
  rating?: number | null;
  additionalDuration?: number | null;
  clientId: string;
  nailMasterId: string;
  masterServiceId?: string | null;
  serviceIds?: string[] | null;
  nailDesignId?: string | null;
  designSnapshotId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface OrderDesignSnapshot {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  videoUrl?: string | null;
  type: string;
  source: string;
  tags?: string[] | null;
  color?: string | null;
  originalDesignId?: string | null;
  authorName?: string | null;
  authorId?: string | null;
  createdAt: string | Date;
}

export interface OrderEnriched extends Order {
  _design?: OrderDesignSnapshot | { id: string; title: string; images: string[] } | null;
  _client?: { name: string; phone: string; avatar?: string | null } | null;
  _master?: { name: string; phone: string; address?: string; avatar?: string | null } | null;
}

// ── Comment ───────────────────────────────────────────────

export interface Comment {
  id: string;
  text: string;
  parentCommentId?: string | null;
  likesCount: number;
  authorId: string;
  designId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  // Enriched
  author?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export interface CommentThreaded extends Comment {
  replies?: CommentThreaded[];
}

// ── Rating / Review ───────────────────────────────────────

export interface Review {
  id: string;
  comment: string;
  rating?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  clientId: string;
  nailDesignId: string;
  nailMasterId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  // Enriched
  client?: { id: string; name: string; avatarUrl?: string | null };
}

export interface Rating {
  id: string;
  ratingNumber: number;
  description?: string | null;
  createdAt: string | Date;
  nailMasterId: string;
  clientId: string;
}

// ── Notification ──────────────────────────────────────────

export type NotificationType =
  | 'order_created'
  | 'order_confirmed'
  | 'order_declined'
  | 'order_timeout'
  | 'alternative_time_proposed'
  | 'rating_decreased'
  | 'order_cancelled'
  | 'order_completed'
  | 'new_design_uploaded'
  | 'new_comment'
  | 'new_review'
  | 'master_response'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  isSent: boolean;
  metadata?: unknown;
  recipientId: string;
  relatedOrderId?: string | null;
  createdAt: string | Date;
}

// ── Schedule ──────────────────────────────────────────────

export interface ScheduleSlot {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
  notes?: string | null;
  masterId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// ── Message ───────────────────────────────────────────────

export interface MessageAttachment {
  url: string;
  type: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  relatedOrderId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachments?: MessageAttachment[] | null;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSenderName?: string | null;
  isDeleted: boolean;
  isEdited: boolean;
  editedAt?: string | Date | null;
  isRead: boolean;
  createdAt: string | Date;
  // Enriched
  sender?: { id: string; name: string; avatarUrl?: string | null };
}

// ── Admin ─────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalMasters: number;
  totalClients: number;
  totalDesigns: number;
  totalOrders: number;
  activeOrders: number;
  totalUploads: number;
  revenue: number;
}

export interface AdminUser {
  id: string;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  isGuest: boolean;
  blocked: boolean;
  createdAt: string | Date;
}
