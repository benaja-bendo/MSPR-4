import { Body, Controller, Get, Post } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { passwordSchema } from '@cofrap/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('hash')
  async hashPassword(@Body() body: { password: string }) {
    const parsed = passwordSchema.safeParse(body.password);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().formErrors };
    }

    const hash = await bcrypt.hash(parsed.data, 12);
    return { success: true, hash };
  }

  @Post('validate')
  async validatePassword(@Body() body: { password: string; hash: string }) {
    const parsed = passwordSchema.safeParse(body.password);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().formErrors };
    }

    const valid = await bcrypt.compare(parsed.data, body.hash);
    return { success: true, valid };
  }
}
