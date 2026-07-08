import { NextResponse } from 'next/server';

// Стандартная структура ответа (как в оригинальном ТЗ)
export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function successResponse<T>(data: T, message?: string, status = 200) {
  const body: ApiResponse<T> = { success: true, data, message };
  return NextResponse.json(body, { status });
}

export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number; totalPages: number },
  status = 200,
) {
  const body: ApiResponse<T[]> = { success: true, data, pagination };
  return NextResponse.json(body, { status });
}

export function errorResponse(error: string, status = 400) {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status });
}

export function createdResponse<T>(data: T, message = 'Created successfully') {
  return successResponse(data, message, 201);
}

export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}
