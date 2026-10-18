import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@generated/prisma/enums';

export class LoginDto {
  @ApiProperty({ example: 'ahmad_fauzi', description: 'Username pengguna' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  username!: string;

  @ApiProperty({ example: 'rahasia123', description: 'Password pengguna' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  password!: string;

  @ApiPropertyOptional({
    example: 'dev-a1b2c3',
    description:
      'ID perangkat. Wajib diisi untuk role Mahasantri (device binding), diabaikan untuk role lain.',
  })
  @IsOptional()
  @IsString()
  device_id?: string;
}

export class MusyrifSummaryDto {
  @ApiProperty({ example: 'uuid-musyrif' })
  id_musyrif!: string;

  @ApiProperty({ example: 'Ustadz Abdul Rahman' })
  nama!: string;
}

export class MusyrifProfileDto {
  @ApiProperty({ example: 'uuid-musyrif' })
  id_musyrif!: string;

  @ApiProperty({ example: 'Ustadz Abdul Rahman' })
  nama!: string;

  @ApiProperty({ example: '081234567890' })
  no_telepon!: string;
}

export class MahasantriProfileDto {
  @ApiProperty({ example: '2210512001' })
  nim!: string;

  @ApiProperty({ example: 'Ahmad Fauzi' })
  nama!: string;

  @ApiProperty({ example: 'A-12' })
  kamar!: string;

  @ApiProperty({ example: true })
  status_aktif!: boolean;

  @ApiProperty({ type: () => MusyrifSummaryDto })
  musyrif!: MusyrifSummaryDto;
}

export class UserDto {
  @ApiProperty({ example: 'uuid-pengguna' })
  id_pengguna!: string;

  @ApiProperty({ example: 'ahmad_fauzi' })
  username!: string;

  @ApiProperty({ enum: Role, example: Role.Mahasantri })
  role!: Role;

  /**
   * Profil bergantung role: Mahasantri untuk role Mahasantri, Musyrif untuk
   * role Musyrif, dan null untuk role lain (mis. Admin). Didokumentasikan
   * dengan oneOf lewat @ApiExtraModels di AuthController.
   */
  profil!: MusyrifProfileDto | MahasantriProfileDto | null;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'Bearer', description: 'Tipe token' })
  token_type!: 'Bearer';

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'JWT yang dipakai di header Authorization',
  })
  access_token!: string;

  @ApiProperty({ type: () => UserDto })
  user!: UserDto;
}
