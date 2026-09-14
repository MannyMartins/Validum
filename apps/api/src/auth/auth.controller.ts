import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService, SessionPayload } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
class ResetDto { @IsEmail() email!: string; }
class SetupDto { @IsString() @MinLength(32) token!: string; @IsString() @MinLength(8) password!: string; }
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @UseGuards(JwtAuthGuard) @Get('me') me(@Req() request: { user: SessionPayload }) { return this.auth.me(request.user); }
  @Post('password-reset') async reset(@Body() dto: ResetDto) { await this.auth.requestPasswordReset(dto.email); return { success: true }; }
  @Post('password-setup') setup(@Body() dto: SetupDto) { return this.auth.completePasswordSetup(dto.token, dto.password); }
}
