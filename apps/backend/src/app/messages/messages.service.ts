import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmulatorType,
  MessageDisposition,
  TrackingMessage,
  TrackingMessageDocument,
} from './message.schema';
import { AppLogger } from '../common/logger.service';

type NewTrackingMessage = Pick<
  TrackingMessage,
  | 'messageId' | 'body' | 'sentBy' | 'sentAt' | 'status' | 'queue' | 'emulatorType'
>;

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(TrackingMessage.name, 'MessageTrackingDb')
    private readonly messageModel: Model<TrackingMessageDocument>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(MessageService.name);
  }

  async findTrackingMessages(): Promise<TrackingMessage[]> {
    return this.messageModel.find().sort({ sentAt: -1 }).lean().exec();
  }

  async findTrackingMessagesByEmulator(
    emulatorType: EmulatorType,
  ): Promise<TrackingMessage[]> {
    return this.messageModel
      .find({ emulatorType })
      .sort({ sentAt: -1 })
      .lean()
      .exec();
  }

  async findOneTracking(id: string): Promise<TrackingMessage | null> {
    return this.messageModel.findById(id).lean().exec();
  }

  async findOneTrackingByMessageId(
    messageId: string,
    emulatorType: EmulatorType,
  ): Promise<TrackingMessage | null> {
    return this.messageModel.findOne({ messageId, emulatorType }).lean().exec();
  }

  async createTracking(
    message: Partial<TrackingMessage>,
  ): Promise<TrackingMessageDocument> {
    this.logger.log(`Creating tracking entry for ${message.messageId}`);
    return new this.messageModel(message).save();
  }

  async ensureTracking(
    message: NewTrackingMessage,
  ): Promise<TrackingMessage & { _id: unknown }> {
    return this.messageModel
      .findOneAndUpdate(
        {
          messageId: message.messageId,
          emulatorType: message.emulatorType,
        },
        { $setOnInsert: message },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec() as unknown as TrackingMessage & { _id: unknown };
  }

  async updateTracking(
    id: string,
    message: Partial<TrackingMessage>,
  ): Promise<TrackingMessage | null> {
    return this.messageModel
      .findByIdAndUpdate(id, { $set: message }, { new: true })
      .lean()
      .exec();
  }

  async removeTracking(id: string): Promise<void> {
    const result = await this.messageModel.findByIdAndDelete(id).exec();
    if (!result) {
      this.logger.warn(`No tracking document found with id ${id}`);
      return;
    }

    this.logger.log(`Removed tracking document ${id}`);
  }

  async markMessageReceived(
    messageId: string,
    emulatorType: EmulatorType,
    receivedBy: string,
  ): Promise<TrackingMessage | null> {
    const update = await this.messageModel
      .findOneAndUpdate(
        { messageId, emulatorType },
        {
          $set: {
            status: 'received',
            receivedAt: new Date(),
            receivedBy,
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!update) {
      this.logger.warn(
        `No ${emulatorType} tracking document found for received message ${messageId}`,
      );
    }

    return update;
  }

  async updateDisposition(
    messageId: string,
    emulatorType: EmulatorType,
    disposition: MessageDisposition,
    receivedBy: string,
  ): Promise<TrackingMessage | null> {
    const update = await this.messageModel
      .findOneAndUpdate(
        { messageId, emulatorType },
        {
          $set: {
            disposition,
            status: 'received',
            receivedAt: new Date(),
            receivedBy,
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!update) {
      this.logger.warn(
        `No ${emulatorType} tracking document found for message ${messageId}`,
      );
    }

    return update;
  }
}
