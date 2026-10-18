import { Type } from '@nestjs/common';
import { getSchemaPath } from '@nestjs/swagger';

/**
 * Skema respons sukses yang dibungkus TransformInterceptor
 * (`{ success, statusCode, message, data }`).
 */
export function successSchema(
  data: Record<string, unknown>,
  statusCode = 200,
  message = 'Operasi berhasil',
) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      statusCode: { type: 'number', example: statusCode },
      message: { type: 'string', example: message },
      data,
    },
  };
}

/** Skema respons error dari HttpExceptionFilter. */
export function errorSchema(example: {
  statusCode: number;
  message: string;
  error: string;
}) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      statusCode: { type: 'number', example: example.statusCode },
      message: { type: 'string', example: example.message },
      error: { type: 'string', example: example.error },
    },
  };
}

/** `$ref` menuju skema model yang didaftarkan lewat `@ApiExtraModels`. */
export function modelRef(model: Type<unknown>) {
  return { $ref: getSchemaPath(model) };
}

/** Skema array of model. */
export function arrayModelRef(model: Type<unknown>) {
  return { type: 'array', items: { $ref: getSchemaPath(model) } };
}

/**
 * 401 umum: token tidak disertakan, tidak valid, kedaluwarsa, atau akun
 * ditolak JwtStrategy. Dipakai semua endpoint yang butuh token.
 */
export function unauthorizedResponse() {
  return {
    status: 401,
    description: 'Tidak terautentikasi: token tidak ada, tidak sah, atau kedaluwarsa',
    schema: errorSchema({
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    }),
  };
}

/** 403 umum: token sah tetapi role-nya tidak diizinkan (RolesGuard). */
export function forbiddenResponse() {
  return {
    status: 403,
    description: 'Terlarang: role ini tidak memiliki akses ke resource ini',
    schema: errorSchema({
      statusCode: 403,
      message: 'Anda tidak memiliki akses ke resource ini',
      error: 'ERR_FORBIDDEN_ROLE',
    }),
  };
}

/** 400 umum: validasi global gagal (ERR_VALIDATION). */
export function validationResponse(
  message = 'Validasi gagal, periksa kembali body request',
) {
  return {
    status: 400,
    description: 'Validasi gagal (ERR_VALIDATION)',
    schema: errorSchema({ statusCode: 400, message, error: 'ERR_VALIDATION' }),
  };
}
