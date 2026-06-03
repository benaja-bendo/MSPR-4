import { Body, Controller, Get, Post } from '@nestjs/common';
import { mfaConfirmSchema, mfaSetupSchema } from '@cofrap/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('setup')
  async setup(@Body() body: unknown) {
    const parsed = mfaSetupSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }
    return this.appService.setup(parsed.data.username);
  }

  @Post('confirm')
  async confirm(@Body() body: unknown) {
    const parsed = mfaConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }
    return this.appService.confirm(parsed.data.username, parsed.data.code);
  }
}
