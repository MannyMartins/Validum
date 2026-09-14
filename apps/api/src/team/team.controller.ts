import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { SessionPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamService } from './team.service';
class InviteDto { @IsString() @MinLength(2) @MaxLength(120) fullName!: string; @IsEmail() email!: string; @IsIn(['admin', 'operator', 'auditor']) role!: string; }
class RoleDto { @IsIn(['admin', 'operator', 'auditor']) role!: string; }
@UseGuards(JwtAuthGuard) @Controller('team')
export class TeamController {
  constructor(private team: TeamService) {}
  @Get() list(@Req() req: { user: SessionPayload }) { return this.team.list(req.user.organizationId, req.user.sub, req.user.membershipRole); }
  @Post('invite') invite(@Req() req: { user: SessionPayload }, @Body() body: InviteDto) { return this.team.invite(req.user.organizationId, req.user.membershipRole, body); }
  @Post(':userId/revoke') revoke(@Req() req: { user: SessionPayload }, @Param('userId') userId: string) { return this.team.revoke(req.user.organizationId, req.user.sub, req.user.membershipRole, userId); }
  @Patch(':userId/role') role(@Req() req: { user: SessionPayload }, @Param('userId') userId: string, @Body() body: RoleDto) { return this.team.changeRole(req.user.organizationId, req.user.membershipRole, userId, body.role); }
}
