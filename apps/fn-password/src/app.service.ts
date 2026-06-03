import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { generateCompliantPassword } from '@cofrap/crypto';
import { prisma } from '@cofrap/database';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'fn-password' };
  }

  async generateForUser(username: string, renew = false) {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return { success: false, error: 'Utilisateur introuvable. Créez le compte via fn-auth/register.' };
    }

    const canRegenerate = renew || user.expired || user.status === 'expired';
    if (user.passwordQrUsed && !canRegenerate) {
      return {
        success: false,
        error: 'Le QR mot de passe a déjà été généré (usage unique). Renouvelez si le compte est expiré.',
      };
    }

    const plainPassword = generateCompliantPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const qrPayload = JSON.stringify({
      username,
      password: plainPassword,
      hint: 'Conservez ce mot de passe — affichage unique via QR COFRAP',
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        gendate: new Date(),
        expired: false,
        status: 'pending_mfa',
        passwordQrUsed: true,
        mfaEnc: renew ? null : user.mfaEnc,
        mfaEnabled: renew ? false : user.mfaEnabled,
      },
    });

    return {
      success: true,
      username,
      qrDataUrl,
      status: 'pending_mfa',
      message: 'Scannez le QR une seule fois pour récupérer votre mot de passe, puis activez la 2FA.',
    };
  }
}
