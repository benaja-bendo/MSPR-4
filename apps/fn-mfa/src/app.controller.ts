import { Body, Controller, Get, Post } from '@nestjs/common';
import { mfaVerifySchema } from '@cofrap/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('setup')
  setupMfa(@Body() body: { userId: string }) {
    if (!body.userId) {
      return { success: false, error: 'userId requis' };
    }

    const secret = this.appService.generateSecret();
    return {
      success: true,
      userId: body.userId,
      secret,
      otpauthUrl: `otpauth://totp/COFRAP:${body.userId}?secret=${secret}&issuer=COFRAP`,
    };
  }

  @Post('verify')
  verifyMfa(@Body() body: unknown) {
    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    return {
      success: true,
      verified: this.appService.verifyCode(parsed.data.code),
    };
  }
}
