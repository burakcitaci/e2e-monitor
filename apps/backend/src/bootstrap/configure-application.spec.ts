import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Exclude } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { HttpModule } from '../app/common/http/http.module';
import { AppLogger } from '../app/common/logging/logger.service';
import { configureApplication } from './configure-application';

class ContractDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() @Min(1) count!: number;
}

class ContractResponse {
  name = 'collector';
  @Exclude() internal = 'not public';
}

@Controller('bootstrap-contract')
class ContractController {
  @Get() get() {
    return new ContractResponse();
  }
  @Post() create(@Body() dto: ContractDto) {
    return dto;
  }
}

describe('application HTTP configuration', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [ContractController],
    })
      .overrideProvider(AppLogger)
      .useValue({ setContext: jest.fn(), log: jest.fn(), error: jest.fn() })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApplication(app, {
      corsOrigin: ['http://first.test', 'http://second.test'],
    });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('preserves URI versioning and class serialization', async () => {
    const response = await fetch(`${baseUrl}/api/v1/bootstrap-contract`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'collector' });
    expect((await fetch(`${baseUrl}/bootstrap-contract`)).status).toBe(404);
  });

  it('transforms DTOs while rejecting unknown fields with the existing error envelope', async () => {
    const post = (body: object) =>
      fetch(`${baseUrl}/api/v1/bootstrap-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const accepted = await post({ name: 'topic', count: '2' });
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toEqual({ name: 'topic', count: 2 });
    const rejected = await post({ name: 'topic', count: 2, id: 'client-id' });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({
      statusCode: 400,
      path: '/api/v1/bootstrap-contract',
      message: ['property id should not exist'],
      timestamp: expect.any(String),
    });
  });

  it('preserves credentialed CORS and preflight headers for configured origins', async () => {
    const response = await fetch(`${baseUrl}/api/v1/bootstrap-contract`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://second.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://second.test',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'Content-Type,Authorization',
    );
  });
});
