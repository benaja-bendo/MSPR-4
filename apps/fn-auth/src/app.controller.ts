import { Body, Controller, Get, Post } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { loginSchema, registerSchema } from '@cofrap/shared-types';
import { prisma } from '@cofrap/database';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return { success: false, error: 'Cet e-mail est déjà utilisé' };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, user };
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const session = await this.appService.createSession(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
      },
      session,
    };
  }
}
