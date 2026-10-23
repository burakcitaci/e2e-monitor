import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Schema } from 'mongoose';
import { CaptureEventDto } from './capture-event.dto';
import {
  applyCaptureEvent,
  captureTrackingRows,
  CaptureState,
} from './capture-state';

export interface CapturedMessage {
  _id: string;
  revision: number;
  state: CaptureState;
}

export const CapturedMessageSchema = new Schema<CapturedMessage>(
  {
    _id: String,
    revision: { type: Number, required: true },
    state: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'CapturedMessages', timestamps: true },
);

@Injectable()
export class CaptureService {
  constructor(
    @InjectModel('CapturedMessage', 'MessageTrackingDb')
    private readonly model: Model<CapturedMessage>,
  ) {}

  async ingest(event: CaptureEventDto) {
    const id = createHash('sha256')
      .update(
        JSON.stringify([event.namespace, event.destination, event.captureId]),
      )
      .digest('hex');
    // Revision compare-and-swap prevents simultaneous sender/subscriber reports
    // from losing updates. Deterministic _id also handles concurrent first reports.
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await this.model.findById(id).lean().exec();
      const state = applyCaptureEvent(current?.state, event);
      if (!current) {
        try {
          await this.model.create({ _id: id, revision: 0, state });
          return { captureId: event.captureId };
        } catch (error) {
          if ((error as { code?: number }).code === 11000) continue;
          throw error;
        }
      }
      const result = await this.model
        .updateOne(
          { _id: id, revision: current.revision },
          { $set: { state }, $inc: { revision: 1 } },
        )
        .exec();
      if (result.modifiedCount) return { captureId: event.captureId };
    }
    throw new ServiceUnavailableException(
      'Concurrent capture updates; retry this event',
    );
  }

  async trackingRows() {
    const captures = await this.model.find().lean().exec();
    return captures.flatMap<ReturnType<typeof captureTrackingRows>[number]>(
      (capture) => captureTrackingRows(capture._id, capture.state),
    );
  }

  async allStates() {
    return this.model
      .find()
      .select({ state: 1 })
      .lean()
      .exec()
      .then((items) =>
        items.map((item) => ({ id: String(item._id), state: item.state })),
      );
  }

  async detail(id: string) {
    const capture = await this.model.findById(id).lean().exec();
    if (!capture) return null;
    const rows = captureTrackingRows(id, capture.state);
    return {
      ...rows[0],
      _id: id,
      queue: capture.state.destination,
      deliveries: capture.state.deliveries,
    };
  }
}
