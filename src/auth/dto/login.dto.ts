import {IsNotEmpty, IsString, MaxLength} from 'class-validator';
import {Role} from "../../../generated/prisma/enums";

export class LoginDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    username!: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    password!: string;

    @IsNotEmpty()
    @IsString()
    device_id!: string;
}

export class MusyrifSummaryDto {
    id_musyrif!: string;
    nama!: string;
}

export class MusyrifProfileDto {
    id_musyrif!: string;
    nama!: string;
    no_telepon!: string;
}

export class MahasantriProfileDto {
    nim!: string;
    nama!: string;
    kamar!: string;
    status_aktif!: boolean;
    musyrif!: MusyrifSummaryDto;
}


export class UserDto {
    id_pengguna: string;
    username: string;
    role: Role;
    profil: MusyrifProfileDto | MahasantriProfileDto | null;

}

export class AuthResponseDto {
    token_type: "Bearer";
    access_token: string;
    user: UserDto;
}