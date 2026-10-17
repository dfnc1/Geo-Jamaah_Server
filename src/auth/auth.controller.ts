import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponseDto, LoginDto } from './dto/login.dto';
import { Public } from '@src/auth/decorators/public.decorator';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @Public()
  async login(@Body() request: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(request);
  }
}
