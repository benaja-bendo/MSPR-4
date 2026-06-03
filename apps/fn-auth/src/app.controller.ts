import { Body, Controller, Get, Post } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import {
  isCredentialExpired,
  loginSchema,
  registerSchema,
  renewSchema,
} from '@cofrap/shared-types';
import { decrypt } from '@cofrap/crypto';
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
      where: { username: parsed.data.username },
    });
    if (existing) {
      return { success: false, error: 'Cet identifiant est déjà utilisé' };
    }

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        status: 'pending_password',
        passwordQrUsed: false,
      },
      select: {
        id: true,
        username: true,
        status: true,
      },
    });

    return {
      success: true,
      user,
      nextStep: 'Appeler fn-password/generate puis fn-mfa/setup et confirm',
    };
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (!user || !user.passwordHash) {
      return { success: false, error: 'Identifiants invalides' };
    }

    if (isCredentialExpired(user.gendate) || user.expired) {
      await prisma.user.update({
        where: { id: user.id },
        data: { expired: true, status: 'expired', passwordQrUsed: false },
      });
      return {
        success: false,
        expired: true,
        error: 'Identifiants expirés (> 6 mois). Renouvelez mot de passe et 2FA.',
        action: 'renew',
      };
    }

    if (user.status !== 'active' || !user.mfaEnabled || !user.mfaEnc) {
      return {
        success: false,
        error: 'Compte non activé. Terminez la configuration (mot de passe + 2FA).',
        status: user.status,
      };
    }

    const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const secret = decrypt(user.mfaEnc);
    const validTotp = authenticator.verify({
      token: parsed.data.totpCode,
      secret,
    });
    if (!validTotp) {
      return { success: false, error: 'Code 2FA invalide' };
    }

    const session = await this.appService.createSession(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        mfaEnabled: user.mfaEnabled,
        gendate: user.gendate,
      },
      session,
    };
  }

  @Post('renew')
  async renew(@Body() body: unknown) {
    const parsed = renewSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (!user) {
      return { success: false, error: 'Utilisateur introuvable' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        expired: true,
        status: 'expired',
        passwordQrUsed: false,
        mfaEnc: null,
        mfaEnabled: false,
      },
    });

    return {
      success: true,
      username: user.username,
      action: 'renew',
      message: 'Relancez fn-password/generate (renew:true) puis fn-mfa.',
    };
  }
}
