import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePolicyDto, UpdatePolicyDto } from './policy.dto';
import { PoliciesService } from './policies.service';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly service: PoliciesService) {}
  @Get() async list() {
    return { success: true, data: await this.service.list() };
  }
  @Post() async create(@Body() dto: CreatePolicyDto) {
    return { success: true, data: await this.service.create(dto) };
  }
  @Patch(':id') async update(
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return { success: true, data: await this.service.update(id, dto) };
  }
  @Delete(':id') async remove(@Param('id') id: string) {
    return { success: true, data: await this.service.remove(id) };
  }
  @Get(':id/evaluate') async evaluate(@Param('id') id: string) {
    return { success: true, data: await this.service.evaluate(id) };
  }
}
