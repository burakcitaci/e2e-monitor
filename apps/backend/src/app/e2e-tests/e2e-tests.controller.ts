import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateScenarioDto, StartDemoRunDto } from './e2e-tests.dto';
import { E2eTestsService } from './e2e-tests.service';

@Controller('e2e-tests')
export class E2eTestsController {
  constructor(private readonly service: E2eTestsService) {}

  @Get('scenarios')
  async listScenarios() {
    return { success: true, data: await this.service.listScenarios() };
  }

  @Post('scenarios')
  async createScenario(@Body() dto: CreateScenarioDto) {
    return { success: true, data: await this.service.createScenario(dto) };
  }

  @Post('scenarios/:id/demo-runs')
  async startDemo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartDemoRunDto,
  ) {
    return {
      success: true,
      data: await this.service.startDemo(id, dto.outcome),
    };
  }

  @Get('runs')
  async listRuns() {
    return { success: true, data: await this.service.listRuns() };
  }

  @Get('runs/:id')
  async getRun(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.service.getRun(id) };
  }
}
