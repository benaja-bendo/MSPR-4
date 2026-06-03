import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { encrypt, decrypt } from '@cofrap/crypto';
import { prisma } from '@cofrap/database';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'fn-mfa' };
  }

  async setup(username: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return { success: false, error: 'Utilisateur introuvable' };
    }
    if (!user.passwordHash) {
      return { success: false, error: 'Générez d’abord le mot de passe (fn-password/generate)' };
    }
    if (user.status !== 'pending_mfa' && user.status !== 'expired' && !user.expired) {
      return { success: false, error: 'Étape MFA non requise pour ce compte' };
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(username, 'COFRAP', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnc: encrypt(secret),
        mfaEnabled: false,
        status: 'pending_mfa',
      },
    });

    return {
      success: true,
      username,
      qrDataUrl,
      otpauthUrl,
      message: 'Scannez le QR avec votre application 2FA, puis confirmez avec un code.',
    };
  }

  async confirm(username: string, code: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.mfaEnc) {
      return { success: false, error: 'Configuration MFA introuvable' };
    }

    const secret = decrypt(user.mfaEnc);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      return { success: false, error: 'Code 2FA invalide' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        status: 'active',
        expired: false,
        gendate: new Date(),
      },
    });

    return { success: true, username, status: 'active', message: 'Compte activé avec 2FA.' };
  }
}
