import { Body, Controller, Get, Post } from '@nestjs/common';
import { generatePasswordSchema } from '@cofrap/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('generate')
  async generate(@Body() body: unknown) {
    const parsed = generatePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    return this.appService.generateForUser(parsed.data.username, parsed.data.renew ?? false);
  }
}
