import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Mongoose } from 'mongoose';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { CaptureService } from './capture/capture.service';
import { MessagingChatRuntime } from './messaging-chat/messaging-chat.runtime';
import { PoliciesService } from './policies/policies.service';

describe('application module wiring', () => {
  it('resolves shared infrastructure and feature providers without opening a database connection', async () => {
    const connection = new Mongoose().createConnection();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken('MessageTrackingDb'))
      .useValue(connection)
      .compile();
    try {
      expect(module.get(AppConfigService)).toBeInstanceOf(AppConfigService);
      expect(module.get(CaptureService)).toBeInstanceOf(CaptureService);
      expect(module.get(PoliciesService)).toBeInstanceOf(PoliciesService);
      expect(module.get(MessagingChatRuntime)).toBeInstanceOf(
        MessagingChatRuntime,
      );
    } finally {
      await module.close();
    }
  });
});
