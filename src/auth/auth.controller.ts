// .env harus dimuat sebelum kelas didefinisikan: @Throttle di bawah
// membaca process.env.THROTTLE_LOGIN_LIMIT pada waktu import.
import '@src/load-env';
import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  LoginDto,
  MahasantriProfileDto,
  MusyrifProfileDto,
} from './dto/login.dto';
import { Public } from '@src/auth/decorators/public.decorator';
import { Audit } from '@src/activity-log/activity-log.interceptor';
import { parseThrottleLimit } from '@src/common/throttle-limit';

/** Batas login per 60 detik per IP, dari env (default 20). */
const LOGIN_RATE_LIMIT = parseThrottleLimit(
  process.env.THROTTLE_LOGIN_LIMIT,
  20,
  'THROTTLE_LOGIN_LIMIT',
);

/** Skema respons sukses yang dibungkus TransformInterceptor. */
function loginSuccessSchema() {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      statusCode: { type: 'number', example: 201 },
      message: { type: 'string', example: 'Login berhasil' },
      data: { $ref: getSchemaPath(AuthResponseDto) },
    },
  };
}

/** Skema respons error dari HttpExceptionFilter. */
function errorSchema(example: Record<string, unknown>) {
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

@ApiTags('Auth')
@ApiExtraModels(AuthResponseDto, MusyrifProfileDto, MahasantriProfileDto)
@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @Public()
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: 60_000 } })
  @Audit(
    'Auth',
    () => 'Login berhasil',
    {
      // Login satu-satunya aksi yang dicatat saat gagal.
      catatGagal: true,
      // Teks dari kode error whitelist `ERR_XXX` (bukan body mentah).
      teksGagal: ({ kodeError, usernameTerdaftar }) => {
        if (!usernameTerdaftar) return 'Login gagal: username tidak terdaftar';
        switch (kodeError) {
          case 'ERR_INVALID_CREDENTIALS':
            // Sengaja memakai "kata sandi" (bukan "password") supaya teks
            // log tidak pernah memuat token kredensial — grep harfiah
            // 'password' harus 0 baris.
            return 'Login gagal: username atau kata sandi salah';
          case 'ERR_DEVICE_MISMATCH':
            return 'Login gagal: perangkat sudah terikat akun lain';
          case 'ERR_ACCOUNT_INACTIVE':
            return 'Login gagal: akun tidak aktif';
          case 'ERR_DEVICE_ID_REQUIRED':
            // Frasa "perangkat" menggantikan nama field `device_id` supaya
            // grep harfiah 'device_id' juga 0 baris.
            return 'Login gagal: perangkat wajib diisi untuk Mahasantri';
          default:
            return `Login gagal (${kodeError})`;
        }
      },
    },
  )
  @ApiOperation({
    summary: 'Login pengguna',
    description:
      'Mengautentikasi pengguna dan mengembalikan JWT. `device_id` wajib untuk role Mahasantri. ' +
      'Field `user.profil` bernilai Mahasantri, Musyrif, atau null (mis. untuk Admin). ' +
      `Login dibatasi ${LOGIN_RATE_LIMIT} percobaan per menit per IP (env THROTTLE_LOGIN_LIMIT).`,
  })
  @ApiResponse({
    status: 201,
    description: 'Login berhasil',
    schema: {
      allOf: [
        loginSuccessSchema(),
        {
          properties: {
            data: {
              allOf: [
                { $ref: getSchemaPath(AuthResponseDto) },
                {
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        profil: {
                          nullable: true,
                          description:
                            'Mahasantri (role Mahasantri), Musyrif (role Musyrif), atau null untuk role lain',
                          oneOf: [
                            { $ref: getSchemaPath(MahasantriProfileDto) },
                            { $ref: getSchemaPath(MusyrifProfileDto) },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Validasi gagal (ERR_VALIDATION) atau device_id wajib untuk Mahasantri (ERR_DEVICE_ID_REQUIRED)',
    schema: errorSchema({
      statusCode: 400,
      message: 'device_id wajib diisi untuk Mahasantri',
      error: 'ERR_DEVICE_ID_REQUIRED',
    }),
  })
  @ApiResponse({
    status: 401,
    description:
      'Kredensial salah (ERR_INVALID_CREDENTIALS) atau perangkat sudah terikat akun lain (ERR_DEVICE_MISMATCH)',
    schema: errorSchema({
      statusCode: 401,
      message: 'Username atau password salah',
      error: 'ERR_INVALID_CREDENTIALS',
    }),
  })
  @ApiResponse({
    status: 403,
    description: 'Akun Mahasantri dinonaktifkan (ERR_ACCOUNT_INACTIVE)',
    schema: errorSchema({
      statusCode: 403,
      message: 'Akun tidak aktif',
      error: 'ERR_ACCOUNT_INACTIVE',
    }),
  })
  @ApiResponse({
    status: 429,
    description: 'Terlalu banyak percobaan login (ERR_TOO_MANY_REQUESTS)',
    schema: errorSchema({
      statusCode: 429,
      message: 'Terlalu banyak permintaan, coba lagi nanti',
      error: 'ERR_TOO_MANY_REQUESTS',
    }),
  })
  async login(@Body() request: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(request);
  }
}
