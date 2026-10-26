import { InjectModel } from '@nestjs/mongoose';
import {
  MessagingResource,
  MessagingResourceDocument,
} from './message-resources.schema';
import { Model } from 'mongoose';
import { CreateMessageResourceDto } from './dto/create-message.dto';
import { UpdateMessageResourceDto } from './dto/update-message.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BrokerProvisionerService } from './broker-provisioner.service';

@Injectable()
export class MessageResourcesService {
  constructor(
    @InjectModel(MessagingResource.name, 'MessageTrackingDb')
    private readonly messagingResourceModel: Model<MessagingResourceDocument>,
    private readonly broker: BrokerProvisionerService,
  ) {}

  async findMessageResources(): Promise<MessagingResource[]> {
    return this.messagingResourceModel.find().lean().exec();
  }
  async createMessageResource(
    dto: CreateMessageResourceDto,
  ): Promise<MessagingResource> {
    const brokerAddress = await this.broker.ensure(dto);
    try {
      const saved = await this.messagingResourceModel
        .findOneAndUpdate(
          { provider: dto.provider, type: dto.type, name: dto.name },
          {
            $set: { brokerAddress, status: dto.status ?? 'active' },
            $addToSet: { subscriptions: { $each: dto.subscriptions ?? [] } },
            $setOnInsert: {
              id: crypto.randomUUID(),
              provider: dto.provider,
              type: dto.type,
              name: dto.name,
            },
          },
          { new: true, upsert: true, runValidators: true },
        )
        .lean()
        .exec();
      if (!saved) throw new Error('Resource record not returned');
      return saved;
    } catch {
      throw new ServiceUnavailableException(
        'The broker resource exists, but saving its MongoDB record failed. Retry the same resource to reconcile it; the broker resource was not deleted.',
      );
    }
  }
  async updateMessageResource(
    id: string,
    dto: UpdateMessageResourceDto,
  ): Promise<MessagingResource> {
    const current = await this.messagingResourceModel
      .findOne({ id })
      .lean()
      .exec();
    if (!current) throw new NotFoundException('Message resource not found');
    if (
      (dto.name !== undefined && dto.name !== current.name) ||
      (dto.provider !== undefined && dto.provider !== current.provider) ||
      (dto.type !== undefined && dto.type !== current.type)
    ) {
      throw new BadRequestException(
        'Broker resources cannot be renamed or moved. Create a new resource instead.',
      );
    }
    const subscriptions = [
      ...new Set([
        ...(current.subscriptions ?? []),
        ...(dto.subscriptions ?? []),
      ]),
    ];
    const brokerAddress = await this.broker.ensure({
      ...current,
      ...dto,
      subscriptions,
    }, current.subscriptions ?? []);
    const result = await this.messagingResourceModel
      .findOneAndUpdate(
        { id },
        { ...dto, subscriptions, brokerAddress },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!result) {
      throw new NotFoundException('Message resource not found');
    }
    return result;
  }
  async deleteMessageResource(id: string): Promise<MessagingResource> {
    const current = await this.messagingResourceModel.findOne({ id }).lean().exec();
    if (!current) {
      throw new NotFoundException('Message resource not found');
    }
    await this.broker.remove(current);
    const result = await this.messagingResourceModel
      .findOneAndDelete({ id })
      .lean()
      .exec();
    if (!result) {
      throw new NotFoundException('Message resource not found');
    }
    return result;
  }
}
