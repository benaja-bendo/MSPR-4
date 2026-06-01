import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'fn-mfa' };
  }

  generateSecret(): string {
    return randomBytes(20).toString('hex');
  }

  verifyCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }
}
