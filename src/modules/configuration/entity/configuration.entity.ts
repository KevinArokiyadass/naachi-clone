import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConfigurationDocument = Configuration & Document;

@Schema({ timestamps: true, versionKey: false, collection: 'configurations' })
export class Configuration extends Document {
  @Prop({ type: Number, default: 500 })
  allowedUserCount: number;

  @Prop({ type: Boolean, default: false })
  forceRestrictOnboarding: boolean;
}

export const ConfigurationSchema = SchemaFactory.createForClass(Configuration);
