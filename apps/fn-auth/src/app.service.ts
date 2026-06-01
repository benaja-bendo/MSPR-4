import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { prisma } from '@cofrap/database';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'fn-auth' };
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const session = await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
      },
      select: {
        token: true,
        expiresAt: true,
      },
    });

    return session;
  }
}
